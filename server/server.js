require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const crypto  = require("crypto");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Restrict CORS to trusted origin ──
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || `http://localhost:${PORT}`;
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));

// ── Body parser with payload guard ──
app.use(express.json({ limit: "10kb" }));

// ── CSRF token endpoint (GET — no mutation, no CSRF needed) ──
app.get("/api/csrf-token", (req, res) => {
  const token = crypto.randomBytes(32).toString("hex");
  res.json({ token });
});

// ── API Routes (CSRF protection is applied inside the router) ──
app.use("/api", require("./routes/resume"));

// ── Serve Static Frontend ──
app.use(express.static(path.join(__dirname, "../client")));

// ── Fallback: SPA catch-all ──
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

// ── Global Error Handler ──
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
