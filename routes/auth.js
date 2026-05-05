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

// ═══════════════════════════════════════════════════════════════════════
// PATCH /api/auth/me — Update current user profile
// ═══════════════════════════════════════════════════════════════════════
router.patch("/me", protect, async (req, res) => {
  try {
    const { name, phone } = req.body;
    
    // Create an object with only the fields that were provided
    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (phone !== undefined) updateFields.phone = phone;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );
    
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");

// ═══════════════════════════════════════════════════════════════════════
// POST /api/auth/forgot-password — Send password reset email
// ═══════════════════════════════════════════════════════════════════════
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      // Return success even if user not found for security (prevents email enumeration)
      return res.json({ success: true, message: "If that email is registered, we sent a reset link." });
    }

    // Generate reset token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    // Point this to the frontend URL! 
    const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;

    const message = `
      <h1>Password Reset Request</h1>
      <p>You requested a password reset for your CampusFind account.</p>
      <p>Please click the link below to reset your password:</p>
      <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:10px 20px;background-color:#06B6D4;color:white;text-decoration:none;border-radius:8px;">Reset Password</a>
      <p>This link is valid for 10 minutes. If you did not request this, please ignore this email.</p>
    `;

    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
         console.warn("[AUTH] EMAIL_USER or EMAIL_PASS not set in .env. Cannot send real email.");
         console.log(`[AUTH] Reset URL would be: ${resetUrl}`);
         return res.json({ success: true, message: "If that email is registered, we sent a reset link." });
      }

      await sendEmail({
        email: user.email,
        subject: "CampusFind Password Reset",
        message,
      });

      res.json({ success: true, message: "If that email is registered, we sent a reset link." });
    } catch (err) {
      console.error("Email send error:", err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ success: false, message: "Email could not be sent" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PUT /api/auth/reset-password/:token — Reset the password
// ═══════════════════════════════════════════════════════════════════════
router.put("/reset-password/:token", async (req, res) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }

    if (!req.body.password || req.body.password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendToken(user, 200, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
