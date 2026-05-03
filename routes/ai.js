// routes/ai.js — Claude-powered AI matching
const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const Item = require("../models/Item");
const { upload } = require("../config/cloudinary");
const axios = require("axios");

// Guard: warn clearly if key is missing (prevents cryptic 500s)
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("⚠️  ANTHROPIC_API_KEY is not set — AI routes will use fallback mode");
}
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "dummy" });

// ═══════════════════════════════════════════════════════════════════════
// POST /api/ai/match — Upload image, get ranked matches
// ═══════════════════════════════════════════════════════════════════════
router.post("/match", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image is required" });
    }

    const imageUrl = req.file.path; // Cloudinary URL

    // ── Step 1: Fetch image as base64 for Claude Vision ──────────────
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });
    const base64Image = Buffer.from(imageResponse.data).toString("base64");
    const mediaType = req.file.mimetype || "image/jpeg";

    // ── Step 2: Ask Claude to describe the item ───────────────────────
    const describeResponse = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Image },
            },
            {
              type: "text",
              text: `Analyze this lost/found item image and extract:
1. Item type/name
2. Category (Electronics/Clothing/Accessories/Books & Notes/ID & Cards/Keys/Bags & Wallets/Sports Equipment/Stationery/Musical Instruments/Glasses & Eyewear/Other)
3. Color(s)
4. Brand (if visible)
5. Distinctive features
6. Condition

Respond ONLY as JSON: {"name":"...","category":"...","colors":[],"brand":"...","features":[],"condition":"...","searchTerms":[]}`,
            },
          ],
        },
      ],
    });

    let itemDetails;
    try {
      const raw = describeResponse.content[0].text;
      itemDetails = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      itemDetails = { searchTerms: [], category: null };
    }

    // ── Step 3: Fetch candidate items from DB ─────────────────────────
    const searchType = req.body.searchType || "found"; // Looking for "found" items to match your "lost" item
    const filter = { type: searchType, status: "active" };
    if (itemDetails.category) filter.category = itemDetails.category;

    const candidates = await Item.find(filter).limit(50);

    if (candidates.length === 0) {
      return res.json({ success: true, matches: [], itemDetails });
    }

    // ── Step 4: Ask Claude to rank matches ────────────────────────────
    const candidateSummaries = candidates.map((c, i) => ({
      index: i,
      id: c._id,
      title: c.title,
      description: (c.description || "").substring(0, 200),
      category: c.category,
      location: typeof c.location === "object" ? c.location?.building || "" : c.location || "",
      date: c.date,
    }));

    const rankResponse = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `I found/lost an item with these details: ${JSON.stringify(itemDetails)}

Here are ${candidates.length} candidate items from the database:
${JSON.stringify(candidateSummaries, null, 2)}

Score each candidate from 0-100 based on how likely it matches the uploaded item.
Consider: category match, description similarity, distinctive features.

Respond ONLY as JSON array: [{"index":0,"score":85,"reason":"..."},...]
Only include items with score >= 30. Sort by score descending.`,
        },
      ],
    });

    let scores;
    try {
      const raw = rankResponse.content[0].text;
      scores = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      scores = [];
    }

    // ── Step 5: Build final response with full item data ──────────────
    const matches = scores
      .filter((s) => s.score >= 30)
      .slice(0, 10)
      .map((s) => ({
        ...candidates[s.index].toObject(),
        matchScore: s.score,
        matchReason: s.reason,
      }));

    res.json({
      success: true,
      itemDetails,
      uploadedImageUrl: imageUrl,
      matches,
    });
  } catch (err) {
    console.error("AI Match error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/ai/tags — Generate tags for an item (called on item creation)
// ═══════════════════════════════════════════════════════════════════════
router.post("/tags", async (req, res) => {
  const { title = "", description = "", category = "" } = req.body;

  // Fallback: extract tags from keywords if Claude is unavailable
  const fallbackTags = [
    ...new Set(
      `${title} ${category} ${description}`
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 10)
    ),
  ];

  // If no API key, skip Claude and return fallback immediately
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ success: true, tags: fallbackTags, source: "fallback" });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Generate 8-10 searchable tags for this lost/found item.\nTitle: ${title}\nCategory: ${category}\nDescription: ${description}\n\nRespond ONLY as JSON array of strings: ["tag1","tag2",...]`,
        },
      ],
    });

    const raw = response.content[0].text;
    const tags = JSON.parse(raw.replace(/```json|```/g, "").trim());
    res.json({ success: true, tags, source: "claude" });
  } catch (err) {
    console.error("[AI/tags] Claude error, using fallback:", err.message);
    // Degrade gracefully — never 500 on the tags endpoint
    res.json({ success: true, tags: fallbackTags, source: "fallback" });
  }
});

module.exports = router;
