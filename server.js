// server.js — Main Express server entry point
require("dotenv").config(); // Load .env variables FIRST

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

// ── Connect to MongoDB ────────────────────────────────────────────────
connectDB();

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, mobile apps)
    if (!origin) return callback(null, true);

    const allowed =
      origin.startsWith("http://localhost") ||          // local dev
      origin.startsWith("http://127.0.0.1") ||          // local dev alt
      origin.startsWith("capacitor://") ||              // ✅ Capacitor APK
      origin.startsWith("ionic://") ||                  // ✅ Ionic APK
      origin.endsWith(".netlify.app") ||                // any Netlify deploy
      origin.endsWith(".onrender.com") ||               // Render previews
      origin === process.env.FRONTEND_URL;              // explicit custom domain

    if (allowed) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// ── Middleware ────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Health check ──────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "FindIt API is running 🎒",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────────────────
app.use("/api/auth",          require("./routes/auth"));
app.use("/api/items",         require("./routes/items"));
app.use("/api/ai",            require("./routes/ai"));
app.use("/api/notifications", require("./routes/notifications"));

// ── 404 Handler ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ── Global Error Handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ── Start Server ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 FindIt API running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 CORS: localhost + *.netlify.app + ${process.env.FRONTEND_URL || "no custom domain"}`);
});