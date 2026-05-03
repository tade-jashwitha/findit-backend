// models/Notification.js — In-app notifications
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type:    {
      type: String,
      enum: ["match_found", "claim_received", "claim_approved", "claim_rejected"],
      required: true,
    },
    message: { type: String, required: true },
    itemId:  { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" }, // the matched item
    read:    { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
