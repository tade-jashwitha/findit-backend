// routes/auth.js — Register, login, get current user
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

// ── Helper: sign JWT ──────────────────────────────────────────────────
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// ── Helper: send token response ───────────────────────────────────────
const sendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  user.password = undefined;
  res.status(statusCode).json({ success: true, token, data: user });
};

// ═══════════════════════════════════════════════════════════════════════
// POST /api/auth/google — Google OAuth (find or create user, no JWT needed)
// Body: { name, email, picture }
// ═══════════════════════════════════════════════════════════════════════
router.post("/google", async (req, res) => {
  try {
    const { name, email, picture } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: "Name and email are required" });
    }

    // Find existing user or create new one
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        picture:     picture || null,
        loginMethod: "google",
        lastLogin:   new Date(),
      });
    } else {
      user.picture   = picture || user.picture;
      user.lastLogin = new Date();
      if (!user.loginMethod) user.loginMethod = "google";
      await user.save();
    }

    // ✅ Return JWT token (same as regular login)
    sendToken(user, 200, res);
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/auth/register
// ═══════════════════════════════════════════════════════════════════════
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { name, email, password, studentId, phone } = req.body;

      // Check if email already registered
      const existing = await User.findOne({ email });
      if (existing) {
        return res
          .status(400)
          .json({ success: false, message: "Email already registered" });
      }

      const user = await User.create({ name, email, password, studentId, phone });
      sendToken(user, 201, res);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════
// POST /api/auth/login
// ═══════════════════════════════════════════════════════════════════════
router.post(
  "/login",
  [
    body("email").isEmail(),
    body("password").notEmpty(),
  ],
  async (req, res) => {
    console.log("[LOGIN] req.body:", req.body); // 🔍 debug
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("[LOGIN] Validation errors:", errors.array());
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { email, password } = req.body;

      // Get user WITH password (select: false normally hides it)
      const user = await User.findOne({ email }).select("+password");
      if (!user || !(await user.comparePassword(password))) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid email or password" });
      }

      sendToken(user, 200, res);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════
// GET /api/auth/me — Get current logged-in user
// ═══════════════════════════════════════════════════════════════════════
router.get("/me", protect, async (req, res) => {
  res.json({ success: true, data: req.user });
});

module.exports = router;
