// server.js — Main Express server entry point
require("dotenv").config(); // Load .env variables FIRST

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

// ── Connect to MongoDB ────────────────────────────────────────────────
connectDB();

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:3000",        // local dev
  "http://localhost:5173",        // Vite dev (if used)
  process.env.FRONTEND_URL,       // set in Render: e.g. https://your-app.vercel.app
].filter(Boolean);               // remove undefined if FRONTEND_URL not set

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
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
app.use("/api/auth",  require("./routes/auth"));
app.use("/api/items", require("./routes/items"));
app.use("/api/ai",    require("./routes/ai"));

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
  console.log(`🌐 Allowed origins: ${allowedOrigins.join(", ")}`);
});