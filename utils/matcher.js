// utils/matcher.js — Smart matching engine for lost vs found items

/**
 * Calculate word overlap score between two strings (0–1)
 */
function wordOverlap(a = "", b = "") {
  const wordsA = a.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 2));
  if (!wordsA.length || !wordsB.size) return 0;
  const matches = wordsA.filter(w => wordsB.has(w)).length;
  return matches / Math.max(wordsA.length, wordsB.size);
}

/**
 * Calculate location similarity score (0–1)
 */
function locationScore(locA = {}, locB = {}) {
  const bA = (locA.building || "").toLowerCase();
  const bB = (locB.building || "").toLowerCase();
  const aA = (locA.specificArea || "").toLowerCase();
  const aB = (locB.specificArea || "").toLowerCase();

  if (!bA || !bB) return 0;
  if (bA === bB) return aA && aB && aA === aB ? 1.0 : 0.7;
  if (bA.includes(bB) || bB.includes(bA)) return 0.5;
  return wordOverlap(bA, bB) * 0.4;
}

/**
 * Calculate date proximity score (0–1)
 * Items within 3 days → high score, > 30 days → 0
 */
function dateProximityScore(dateA, dateB) {
  if (!dateA || !dateB) return 0.5; // neutral if missing
  const diffMs  = Math.abs(new Date(dateA) - new Date(dateB));
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= 1)  return 1.0;
  if (diffDays <= 3)  return 0.85;
  if (diffDays <= 7)  return 0.65;
  if (diffDays <= 14) return 0.40;
  if (diffDays <= 30) return 0.20;
  return 0;
}

/**
 * Master match scorer — compares two items and returns 0–100 score
 *
 * Weights:
 *  - Title similarity:   30%
 *  - Description overlap: 25%
 *  - Category match:      20%
 *  - Location:            15%
 *  - Date proximity:      10%
 */
function scoreMatch(itemA, itemB) {
  // Category must be same for a meaningful match
  const categoryMatch = itemA.category === itemB.category ? 1 : 0;

  const titleScore  = wordOverlap(itemA.title,       itemB.title);
  const descScore   = wordOverlap(itemA.description, itemB.description);
  const locScore    = locationScore(itemA.location,  itemB.location);
  const dateScore   = dateProximityScore(itemA.date, itemB.date);

  // AI tag overlap bonus (Boosted for Computer Vision)
  const tagsA = (itemA.aiTags || []).map(t => t.toLowerCase());
  const tagsB = new Set((itemB.aiTags || []).map(t => t.toLowerCase()));
  const tagOverlap = tagsA.length
    ? tagsA.filter(t => tagsB.has(t)).length / Math.max(tagsA.length, tagsB.size)
    : 0;

  const raw =
    titleScore  * 0.25 +
    descScore   * 0.15 +
    categoryMatch * 0.20 +
    locScore    * 0.15 +
    dateScore   * 0.10 +
    tagOverlap  * 0.15; // Increased weight for vision features!

  return Math.min(Math.round(raw * 100), 99);
}

/**
 * Find top matches for a given item from a pool of opposite-type items
 * Returns array of { item, score, reasons[] } sorted by score desc
 */
function findTopMatches(newItem, candidates, threshold = 25) {
  return candidates
    .map(candidate => {
      const score = scoreMatch(newItem, candidate);
      const reasons = [];

      if (newItem.category === candidate.category)
        reasons.push(`Same category: ${candidate.category}`);
      if (wordOverlap(newItem.title, candidate.title) > 0.4)
        reasons.push("Similar title");
      if (wordOverlap(newItem.description, candidate.description) > 0.3)
        reasons.push("Description keywords match");
      if (locationScore(newItem.location, candidate.location) >= 0.7)
        reasons.push(`Same location: ${candidate.location?.building}`);
        
      // Check vision tags
      const tagsA = (newItem.aiTags || []).map(t => t.toLowerCase());
      const tagsB = new Set((candidate.aiTags || []).map(t => t.toLowerCase()));
      const overlapCount = tagsA.filter(t => tagsB.has(t)).length;
      if (overlapCount > 0) {
        reasons.push(`Matched ${overlapCount} visual feature(s) from image`);
      }

      return { item: candidate, score, reasons };
    })
    .filter(m => m.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

module.exports = { scoreMatch, findTopMatches };
