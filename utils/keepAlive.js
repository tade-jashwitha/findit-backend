// utils/keepAlive.js — Pings Render every 10 minutes to prevent sleep
const https = require("https");

const BACKEND_URL = process.env.RENDER_EXTERNAL_URL ||
  "https://findit-backend-0v6p.onrender.com";

function keepAlive() {
  const url = `${BACKEND_URL}/api/health`;
  https.get(url, (res) => {
    console.log(`[KeepAlive] Pinged ${url} → ${res.statusCode}`);
  }).on("error", (err) => {
    console.log(`[KeepAlive] Failed: ${err.message}`);
  });
}

// Ping every 10 minutes (600,000ms)
const INTERVAL = 10 * 60 * 1000;

module.exports = { startKeepAlive: () => setInterval(keepAlive, INTERVAL) };
