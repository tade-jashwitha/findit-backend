// routes/items.js — CRUD + Auto-match + Claims + Smart sort
const express = require("express");
const router  = express.Router();
const { body, validationResult } = require("express-validator");
const Item         = require("../models/Item");
const Notification = require("../models/Notification");
const { protect, optionalAuth } = require("../middleware/auth");
const { upload } = require("../config/cloudinary");
const { findTopMatches } = require("../utils/matcher");
const { extractImageFeatures } = require("../utils/vision");

// ── Helper: send validation errors ────────────────────────────────────
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
};

// ── Helper: run auto-match after item creation ─────────────────────────
async function runAutoMatch(newItem) {
  try {
    const oppositeType = newItem.type === "lost" ? "found" : "lost";
    const candidates   = await Item.find({
      type: oppositeType,
      status: "active",
      _id: { $ne: newItem._id },
    }).limit(100);

    const topMatches = findTopMatches(newItem, candidates);
    if (!topMatches.length) return [];

    // Save matches on the new item
    newItem.matches = topMatches.map(m => ({
      itemId:    m.item._id,
      score:     m.score,
      reasons:   m.reasons,
      matchedAt: new Date(),
    }));
    await newItem.save();

    // Also save reverse match on each matched item
    for (const m of topMatches) {
      await Item.findByIdAndUpdate(m.item._id, {
        $push: {
          matches: {
            itemId:    newItem._id,
            score:     m.score,
            reasons:   m.reasons,
            matchedAt: new Date(),
          },
        },
      });

      // Notify the owner of the matched item (if they have an account)
      if (m.item.reportedBy) {
        await Notification.create({
          userId:  m.item.reportedBy,
          type:    "match_found",
          message: `⚡ A possible match was found for your ${m.item.type} item "${m.item.title}" — ${m.score}% confidence!`,
          itemId:  m.item._id,
          matchId: newItem._id,
        });
      }
    }

    return topMatches;
  } catch (err) {
    console.error("[AutoMatch] error:", err.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════
// GET /api/items — Browse items with filters + smart sorting
// ═══════════════════════════════════════════════════════════════════════
router.get("/", async (req, res) => {
  try {
    const {
      type,
      category,
      search,
      building,
      status = "active",
      sort   = "recent",   // "recent" | "matches"
      page   = 1,
      limit  = 20,
    } = req.query;

    const filter = { status };
    if (type)     filter.type = type;
    if (category) filter.category = category;
    if (building) filter["location.building"] = new RegExp(building, "i");
    if (search)   filter.$text = { $search: search };

    // Smart sort: by recency OR by number/quality of matches
    const sortObj = sort === "matches"
      ? { "matches.0.score": -1, createdAt: -1 }
      : { createdAt: -1 };

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Item.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit))
        .populate("reportedBy", "name email"),
      Item.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/items/stats
// ═══════════════════════════════════════════════════════════════════════
router.get("/stats", async (req, res) => {
  try {
    const [total, lost, found, reunited] = await Promise.all([
      Item.countDocuments(),
      Item.countDocuments({ type: "lost",  status: "active" }),
      Item.countDocuments({ type: "found", status: "active" }),
      Item.countDocuments({ status: "reunited" }),
    ]);
    res.json({ success: true, data: { total, lost, found, reunited } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/items/my
// ═══════════════════════════════════════════════════════════════════════
router.get("/my", protect, async (req, res) => {
  try {
    const items = await Item.find({ reportedBy: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/items/:id
// ═══════════════════════════════════════════════════════════════════════
router.get("/:id", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate("reportedBy", "name email")
      .populate("matches.itemId", "title type category location date image");
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/items — Create item + auto-match
// ═══════════════════════════════════════════════════════════════════════
router.post(
  "/",
  optionalAuth,
  upload.single("image"),
  [
    body("type").isIn(["lost", "found"]),
    body("title").trim().notEmpty().isLength({ max: 100 }),
    body("description").trim().notEmpty().isLength({ max: 1000 }),
    body("category").notEmpty(),
    body("building").trim().notEmpty(),
    body("date").isISO8601(),
    body("contactEmail").isEmail().normalizeEmail(),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;

    try {
      const itemData = {
        type:         req.body.type,
        title:        req.body.title,
        description:  req.body.description,
        category:     req.body.category,
        date:         req.body.date,
        contactEmail: req.body.contactEmail,
        contactPhone: req.body.contactPhone || null,
        location: {
          building:     req.body.building,
          specificArea: req.body.specificArea || "",
        },
        reward:     req.body.reward ? JSON.parse(req.body.reward) : {},
        reportedBy: req.user?._id || null,
      };

      if (req.file) {
        itemData.image = { url: req.file.path, publicId: req.file.filename };
        
        // 🔥 Integrate Computer Vision (AppDeaser / Gemini Placeholder)
        // This takes the uploaded Cloudinary image and extracts features into tags
        try {
          const visionTags = await extractImageFeatures(req.file.path, req.file.mimetype);
          itemData.aiTags = visionTags;
          console.log("📸 Vision AI Tags Extracted:", visionTags);
        } catch (visionErr) {
          console.error("Vision AI failed, continuing without tags:", visionErr.message);
        }
      }

      const item = await Item.create(itemData);

      // 🤖 Run auto-match asynchronously (don't block response)
      const topMatches = await runAutoMatch(item);

      res.status(201).json({
        success: true,
        data: item,
        matches: topMatches.map(m => ({
          item:    m.item,
          score:   m.score,
          reasons: m.reasons,
        })),
        matchCount: topMatches.length,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════
// POST /api/items/:id/claim — Send a claim request
// ═══════════════════════════════════════════════════════════════════════
router.post("/:id/claim", protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    // Can't claim your own item
    if (item.reportedBy?.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You cannot claim your own item" });
    }

    // Check if already requested
    const already = item.claimRequests.find(
      c => c.requesterId.toString() === req.user._id.toString() && c.status === "pending"
    );
    if (already) {
      return res.status(400).json({ success: false, message: "You already have a pending claim" });
    }

    item.claimRequests.push({
      requesterId: req.user._id,
      message:     req.body.message || "",
      status:      "pending",
    });
    await item.save();

    // Notify the item owner
    if (item.reportedBy) {
      await Notification.create({
        userId:  item.reportedBy,
        type:    "claim_received",
        message: `📩 Someone sent a claim request for your ${item.type} item "${item.title}"`,
        itemId:  item._id,
      });
    }

    res.json({ success: true, message: "Claim request sent" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PATCH /api/items/:id/claim/:claimId — Approve or reject a claim (Step 1 by Finder)
// ═══════════════════════════════════════════════════════════════════════
router.patch("/:id/claim/:claimId", protect, async (req, res) => {
  try {
    const { status } = req.body; // "approved" | "rejected"
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be approved or rejected" });
    }

    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    // Only owner (finder) can approve/reject
    if (item.reportedBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const claim = item.claimRequests.id(req.params.claimId);
    if (!claim) return res.status(404).json({ success: false, message: "Claim not found" });

    claim.status = status;

    // If approved → mark item as "claimed" (awaiting claimant confirmation = Step 2)
    if (status === "approved") item.status = "claimed";

    await item.save();

    // Notify the claimer
    await Notification.create({
      userId:  claim.requesterId,
      type:    status === "approved" ? "claim_approved" : "claim_rejected",
      message: status === "approved"
        ? `✅ Your claim for "${item.title}" was approved by the finder! Please confirm you received it.`
        : `❌ Your claim for "${item.title}" was rejected.`,
      itemId:  item._id,
    });

    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PATCH /api/items/:id/claim/:claimId/confirm — Step 2: Claimant confirms receipt
// ═══════════════════════════════════════════════════════════════════════
router.patch("/:id/claim/:claimId/confirm", protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate("reportedBy", "name email");
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    const claim = item.claimRequests.id(req.params.claimId);
    if (!claim) return res.status(404).json({ success: false, message: "Claim not found" });

    // Only the claimant can confirm receipt
    if (claim.requesterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Only the claimant can confirm receipt" });
    }

    // Claim must be approved first (Step 1 done)
    if (claim.status !== "approved") {
      return res.status(400).json({ success: false, message: "Claim must be approved before confirming" });
    }

    // ✅ Both sides confirmed — mark as fully reunited!
    claim.status   = "confirmed";
    item.status    = "reunited";
    await item.save();

    // Notify the finder that the item has been successfully returned
    if (item.reportedBy) {
      await Notification.create({
        userId:  item.reportedBy._id,
        type:    "item_reunited",
        message: `🎉 "${item.title}" has been successfully returned to its owner! Thank you for helping!`,
        itemId:  item._id,
      });
    }

    // Notify the claimant too
    await Notification.create({
      userId:  claim.requesterId,
      type:    "item_reunited",
      message: `🎉 You have successfully received your item "${item.title}"! Case closed.`,
      itemId:  item._id,
    });

    res.json({ success: true, message: "Item marked as reunited!", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════
// PATCH /api/items/:id/status
// ═══════════════════════════════════════════════════════════════════════
router.patch("/:id/status", protect, async (req, res) => {
  try {
    const { status } = req.body;
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// DELETE /api/items/:id
// ═══════════════════════════════════════════════════════════════════════
router.delete("/:id", protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    if (
      item.reportedBy?.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await item.deleteOne();
    res.json({ success: true, message: "Item removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
