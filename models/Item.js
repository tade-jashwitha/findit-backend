// models/Item.js — Mongoose schema for Lost & Found items
const mongoose = require("mongoose");

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
      building: { type: String, required: true, trim: true },
      specificArea: { type: String, trim: true }, // e.g. "near the vending machine"
    },

    // ── Date item was lost/found ───────────────────────────────────────
    date: {
      type: Date,
      required: true,
    },

    // ── Image (stored on Cloudinary) ──────────────────────────────────
    image: {
      url: { type: String, default: null },
      publicId: { type: String, default: null }, // Cloudinary public_id for deletion
    },

    // ── AI-generated tags (for matching) ──────────────────────────────
    aiTags: [{ type: String }],

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
      amount: { type: Number, default: 0 },
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
      default: null, // null = anonymous report
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ── Indexes for fast searching ────────────────────────────────────────
itemSchema.index({ type: 1, status: 1 });
itemSchema.index({ category: 1 });
itemSchema.index({ "location.building": 1 });
itemSchema.index({ date: -1 });
itemSchema.index({ title: "text", description: "text", aiTags: "text" }); // Full-text search

module.exports = mongoose.model("Item", itemSchema);
