require("dotenv").config();
const express        = require("express");
const cors           = require("cors");
const cookieParser   = require("cookie-parser");
const { doubleCsrf } = require("csrf-csrf");
const rateLimit      = require("express-rate-limit");
const path           = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Trust proxy — required for accurate IP detection behind Nginx/Cloudflare/Railway/Render ──
// Set TRUST_PROXY=1 in production env; leave unset for local dev
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', parseInt(process.env.TRUST_PROXY, 10) || 1);
}

// ── Security headers ──
app.use((req, res, next) => {
  // CSP — restricts resource loading to same origin; blocks inline scripts and framing
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  res.setHeader('X-Content-Type-Options',  'nosniff');
  res.setHeader('X-Frame-Options',         'DENY');
  res.setHeader('Referrer-Policy',         'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection',        '0');  // disabled — CSP is the modern standard
  res.setHeader('Permissions-Policy',      'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

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

// ── Rate limiting — prevents Ollama abuse; logs exceeded attempts for abuse monitoring ──
const aiLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    console.warn(`[rate-limit] exceeded | ip=${req.ip} | path=${req.path}`);
    res.status(429).json({ error: 'Too many requests, please wait a moment.' });
  }
});

// ── CSRF token endpoint ──
app.get("/api/csrf-token", (req, res) => {
  res.json({ token: generateToken(req, res) });
});

// ── API Routes (CSRF + rate limited) ──
app.use("/api", doubleCsrfProtection, aiLimiter, require("./routes/resume"));

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
