const express            = require("express");
const router             = express.Router();
const resumeController   = require("../controllers/resumeController");

const generateSummary    = resumeController.generateSummary;
const improveContent     = resumeController.improveContent;

// ── CSRF token validation middleware ──
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
