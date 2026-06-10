require("dotenv").config();
const express       = require("express");
const cors          = require("cors");
const cookieParser  = require("cookie-parser");
const { doubleCsrf } = require("csrf-csrf");
const path          = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Restrict CORS to trusted origin ──
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || `http://localhost:${PORT}`;
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));

// ── Body parser with payload guard ──
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// ── CSRF protection via csrf-csrf (double-submit cookie pattern) ──
const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret:     () => process.env.CSRF_SECRET || "default-csrf-secret-change-in-prod",
  cookieName:    "x-csrf-token",  // removed __Host- prefix — requires HTTPS, breaks on localhost
  cookieOptions: { sameSite: "strict", secure: process.env.NODE_ENV === "production", httpOnly: true },
  size:          64,
  getTokenFromRequest: (req) => req.headers["x-csrf-token"]
});

// ── CSRF token endpoint ──
app.get("/api/csrf-token", (req, res) => {
  res.json({ token: generateToken(req, res) });
});

// ── API Routes (CSRF protected) ──
app.use("/api", doubleCsrfProtection, require("./routes/resume"));

// ── 404 handler for unmatched /api routes ──
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ── Serve Static Frontend ──
app.use(express.static(path.join(__dirname, "../client")));

// ── Fallback: SPA catch-all ──
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

// ── Global Error Handler (must be after listen) ──
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN' || err.status === 403) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});
