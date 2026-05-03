// models/Item.js — Mongoose schema for Lost & Found items
const mongoose = require("mongoose");

// ── Claim Request sub-schema ───────────────────────────────────────────
const claimRequestSchema = new mongoose.Schema({
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message:     { type: String, default: "" },
  status:      { type: String, enum: ["pending", "approved", "rejected", "confirmed"], default: "pending" },
  createdAt:   { type: Date, default: Date.now },
});

// ── Match sub-schema ───────────────────────────────────────────────────
const matchSchema = new mongoose.Schema({
  itemId:    { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
  score:     { type: Number, required: true },  // 0–100
  reasons:   [{ type: String }],
  matchedAt: { type: Date, default: Date.now },
});

const itemSchema = new mongoose.Schema(
  {
    // ── Core fields ──────────────────────────────────────────────────
    type: {
      type: String,
      enum: ["lost", "found"],
      required: [true, "Item type (lost/found) is required"],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    // ── Classification ────────────────────────────────────────────────
    category: {
      type: String,
      required: true,
      enum: [
        "Electronics",
        "Clothing",
        "Accessories",
        "Books & Notes",
        "ID & Cards",
        "Keys",
        "Bags & Wallets",
        "Sports Equipment",
        "Stationery",
        "Musical Instruments",
        "Glasses & Eyewear",
        "Other",
      ],
    },

    // ── Location ──────────────────────────────────────────────────────
    location: {
      building:     { type: String, required: true, trim: true },
      specificArea: { type: String, trim: true },
    },

    // ── Date item was lost/found ───────────────────────────────────────
    date: {
      type: Date,
      required: true,
    },

    // ── Image (stored on Cloudinary) ──────────────────────────────────
    image: {
      url:      { type: String, default: null },
      publicId: { type: String, default: null },
    },

    // ── AI-generated tags (for matching) ──────────────────────────────
    aiTags: [{ type: String }],

    // ── Auto-match results ────────────────────────────────────────────
    matches: [matchSchema],

    // ── Claim requests (structured contact flow) ──────────────────────
    claimRequests: [claimRequestSchema],

    // ── Contact & reward ──────────────────────────────────────────────
    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    contactPhone: { type: String, default: null },
    reward: {
      offered: { type: Boolean, default: false },
      amount:  { type: Number,  default: 0 },
    },

    // ── Status ────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["active", "claimed", "reunited", "closed"],
      default: "active",
    },

    // ── Reporter (linked to User model) ───────────────────────────────
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes for fast searching ────────────────────────────────────────
itemSchema.index({ type: 1, status: 1 });
itemSchema.index({ category: 1 });
itemSchema.index({ "location.building": 1 });
itemSchema.index({ date: -1 });
itemSchema.index({ "matches.score": -1 });
itemSchema.index({ title: "text", description: "text", aiTags: "text" });

module.exports = mongoose.model("Item", itemSchema);
