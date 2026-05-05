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

// Mongoose post-save hook to send SMS notification
notificationSchema.post("save", async function (doc) {
  try {
    const User = mongoose.model("User");
    const user = await User.findById(doc.userId);
    
    // Check if user exists and has a phone number
    if (user && user.phone) {
      const { sendSMS } = require("../utils/sms");
      // Prepend "CampusFind: " to the message for context
      await sendSMS(user.phone, `CampusFind: ${doc.message}`);
    }
  } catch (err) {
    console.error("Error in Notification post-save hook (SMS):", err);
  }
});

module.exports = mongoose.model("Notification", notificationSchema);
