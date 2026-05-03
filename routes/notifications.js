// routes/notifications.js — Get and mark notifications
const express      = require("express");
const router       = express.Router();
const Notification = require("../models/Notification");
const { protect }  = require("../middleware/auth");

// GET /api/notifications — Get my notifications (unread first)
router.get("/", protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("itemId",  "title type")
      .populate("matchId", "title type");

    const unreadCount = notifications.filter(n => !n.read).length;

    res.json({ success: true, data: notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/notifications/read-all — Mark all as read
router.patch("/read-all", protect, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
    res.json({ success: true, message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/notifications/:id/read — Mark one as read
router.patch("/:id/read", protect, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
