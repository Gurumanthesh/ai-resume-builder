const express  = require("express");
const router   = express.Router();
const { generateSummary, improveContent } = require("../controllers/resumeController");

// ── CSRF token validation on every mutating route ──
function csrfProtect(req, res, next) {
  const token = req.headers["x-csrf-token"];
  if (!token || token.length !== 64) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }
  next();
}

router.post("/generate-summary", csrfProtect, generateSummary);
router.post("/improve-content",  csrfProtect, improveContent);

module.exports = router;
