// models/User.js — Mongoose schema for campus users
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: false,          // Optional — Google users have no password
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    picture: {
      type: String,
      default: null,            // Google profile photo URL
    },
    loginMethod: {
      type: String,
      enum: ["email", "google"],
      default: "email",
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    role: {
      type: String,
      enum: ["student", "staff", "admin"],
      default: "student",
    },
    studentId: { type: String, default: null },
    phone: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    avatar: { type: String, default: null },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true }
);

// ── Hash password before saving (only for email/password users) ──────
userSchema.pre("save", async function (next) {
  if (!this.password || !this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance method: compare password ─────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ── Generate password reset token ─────────────────────────────────────
const crypto = require("crypto");
userSchema.methods.getResetPasswordToken = function () {
  // Generate a raw token
  const resetToken = crypto.randomBytes(20).toString("hex");

  // Hash the token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set expire time (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model("User", userSchema);
