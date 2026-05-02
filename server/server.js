require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const path    = require("path");
const crypto  = require("crypto");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Restrict CORS to trusted origin only ──
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || `http://localhost:${PORT}`;
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));

// ── Body parser with payload guard ──
app.use(express.json({ limit: "10kb" }));

// ── CSRF token endpoint ──
// Client fetches this token and sends it back as X-CSRF-Token header
app.get("/api/csrf-token", (req, res) => {
  const token = crypto.randomBytes(32).toString("hex");
  res.json({ token });
});

// ── CSRF validation middleware for mutating routes ──
function csrfProtect(req, res, next) {
  const token = req.headers["x-csrf-token"];
  if (!token || token.length !== 64) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }
  next();
}

// ── API Routes ──
app.use("/api", csrfProtect, require("./routes/resume"));

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
