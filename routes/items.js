// routes/items.js — CRUD endpoints for lost & found items
const express = require("express");
const router = express.Router();
const { body, query, validationResult } = require("express-validator");
const Item = require("../models/Item");
const { protect, optionalAuth } = require("../middleware/auth");
const { upload } = require("../config/cloudinary");

// ── Helper: send validation errors ────────────────────────────────────
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
};

// ═══════════════════════════════════════════════════════════════════════
// GET /api/items — Browse all items with filters
// ═══════════════════════════════════════════════════════════════════════
router.get("/", async (req, res) => {
  try {
    const {
      type,          // "lost" | "found"
      category,      // e.g. "Electronics"
      search,        // keyword search
      building,      // location filter
      status = "active",
      page = 1,
      limit = 20,
    } = req.query;

    // Build MongoDB filter object
    const filter = { status };
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (building) filter["location.building"] = new RegExp(building, "i");

    // Full-text search if keyword provided
    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Item.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("reportedBy", "name email"), // join user info
      Item.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/items/stats — Dashboard statistics
// ═══════════════════════════════════════════════════════════════════════
router.get("/stats", async (req, res) => {
  try {
    const [total, lost, found, reunited] = await Promise.all([
      Item.countDocuments(),
      Item.countDocuments({ type: "lost", status: "active" }),
      Item.countDocuments({ type: "found", status: "active" }),
      Item.countDocuments({ status: "reunited" }),
    ]);

    res.json({ success: true, data: { total, lost, found, reunited } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/items/:id — Single item detail
// ═══════════════════════════════════════════════════════════════════════
router.get("/:id", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate(
      "reportedBy",
      "name email"
    );
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/items — Create new item report
// ═══════════════════════════════════════════════════════════════════════
router.post(
  "/",
  optionalAuth,                          // Attach user if logged in
  upload.single("image"),               // Handle image upload → Cloudinary
  [
    body("type").isIn(["lost", "found"]),
    body("title").trim().notEmpty().isLength({ max: 100 }),
    body("description").trim().notEmpty().isLength({ max: 1000 }),
    body("category").notEmpty(),
    body("location.building").trim().notEmpty(),
    body("date").isISO8601(),
    body("contactEmail").isEmail().normalizeEmail(),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;

    try {
      const itemData = {
        ...req.body,
        location: JSON.parse(req.body.location || "{}"),
        reward: JSON.parse(req.body.reward || "{}"),
        reportedBy: req.user?._id || null,
      };

      // Attach Cloudinary image info if uploaded
      if (req.file) {
        itemData.image = {
          url: req.file.path,
          publicId: req.file.filename,
        };
      }

      const item = await Item.create(itemData);

      res.status(201).json({ success: true, data: item });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════
// PATCH /api/items/:id/status — Update status (e.g. mark as reunited)
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
// DELETE /api/items/:id — Delete item (owner or admin only)
// ═══════════════════════════════════════════════════════════════════════
router.delete("/:id", protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    // Only the reporter or an admin can delete
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
