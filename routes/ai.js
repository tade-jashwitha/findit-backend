// routes/ai.js — Gemini-powered AI matching
const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Item = require("../models/Item");
const { upload } = require("../config/cloudinary");
const axios = require("axios");

// ── Gemini client ─────────────────────────────────────────────────────
if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️  GEMINI_API_KEY is not set — AI routes will use fallback mode");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy");

// ── Helper: call Gemini text model ────────────────────────────────────
async function geminiText(prompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ── Helper: call Gemini vision model (image + text) ───────────────────
async function geminiVision(prompt, base64Image, mimeType) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent([
    prompt,
    { inlineData: { data: base64Image, mimeType } },
  ]);
  return result.response.text();
}

// ── Helper: safe JSON parse from LLM response ─────────────────────────
function safeParseJSON(text, fallback) {
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return fallback;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// POST /api/ai/match — Upload image, get ranked matches
// ═══════════════════════════════════════════════════════════════════════
router.post("/match", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ success: false, message: "AI service not configured. Add GEMINI_API_KEY to environment." });
    }

    const imageUrl = req.file.path; // Cloudinary URL

    // ── Step 1: Fetch image as base64 for Gemini Vision ──────────────
    const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const base64Image = Buffer.from(imageResponse.data).toString("base64");
    const mimeType = req.file.mimetype || "image/jpeg";

    // ── Step 2: Ask Gemini to describe the item ───────────────────────
    const describePrompt = `Analyze this lost/found item image and extract:
1. Item type/name
2. Category (Electronics/Clothing/Accessories/Books & Notes/ID & Cards/Keys/Bags & Wallets/Sports Equipment/Stationery/Other)
3. Color(s)
4. Brand (if visible)
5. Distinctive features
6. Condition

Respond ONLY as JSON: {"name":"...","category":"...","colors":[],"brand":"...","features":[],"condition":"...","searchTerms":[]}`;

    const describeRaw = await geminiVision(describePrompt, base64Image, mimeType);
    const itemDetails = safeParseJSON(describeRaw, { searchTerms: [], category: null });

    // ── Step 3: Fetch candidate items from DB ─────────────────────────
    const searchType = req.body.searchType || "found";
    const filter = { type: searchType, status: "active" };
    if (itemDetails.category) filter.category = itemDetails.category;

    const candidates = await Item.find(filter).limit(50);

    if (candidates.length === 0) {
      return res.json({ success: true, matches: [], itemDetails });
    }

    // ── Step 4: Ask Gemini to rank matches ────────────────────────────
    const candidateSummaries = candidates.map((c, i) => ({
      index: i,
      id: c._id,
      title: c.title,
      description: (c.description || "").substring(0, 200),
      category: c.category,
      location: typeof c.location === "object" ? c.location?.building || "" : c.location || "",
      date: c.date,
    }));

    const rankPrompt = `I found/lost an item with these details: ${JSON.stringify(itemDetails)}

Here are ${candidates.length} candidate items from the database:
${JSON.stringify(candidateSummaries, null, 2)}

Score each candidate from 0-100 based on how likely it matches the uploaded item.
Consider: category match, description similarity, distinctive features.

Respond ONLY as JSON array: [{"index":0,"score":85,"reason":"..."},...]
Only include items with score >= 30. Sort by score descending.`;

    const rankRaw = await geminiText(rankPrompt);
    const scores = safeParseJSON(rankRaw, []);

    // ── Step 5: Build final response ──────────────────────────────────
    const matches = scores
      .filter((s) => s.score >= 30)
      .slice(0, 10)
      .map((s) => ({
        ...candidates[s.index].toObject(),
        matchScore: s.score,
        matchReason: s.reason,
      }));

    res.json({ success: true, itemDetails, uploadedImageUrl: imageUrl, matches });
  } catch (err) {
    console.error("AI Match error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/ai/tags — Generate tags for an item (called on item creation)
// ═══════════════════════════════════════════════════════════════════════
router.post("/tags", async (req, res) => {
  const { title = "", description = "", category = "" } = req.body;

  // Fallback: keyword extraction when Gemini is unavailable
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

  if (!process.env.GEMINI_API_KEY) {
    return res.json({ success: true, tags: fallbackTags, source: "fallback" });
  }

  try {
    const prompt = `Generate 8-10 searchable tags for this lost/found item.
Title: ${title}
Category: ${category}
Description: ${description}

Respond ONLY as a JSON array of strings: ["tag1","tag2",...]`;

    const raw = await geminiText(prompt);
    const tags = safeParseJSON(raw, fallbackTags);

    res.json({ success: true, tags, source: "gemini" });
  } catch (err) {
    console.error("[AI/tags] Gemini error, using fallback:", err.message);
    res.json({ success: true, tags: fallbackTags, source: "fallback" });
  }
});

module.exports = router;
