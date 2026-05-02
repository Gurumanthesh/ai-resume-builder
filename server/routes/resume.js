const express = require("express");
const router  = express.Router();
const { generateSummary, improveContent } = require("../controllers/resumeController");

router.post("/generate-summary",  generateSummary);
router.post("/improve-content",   improveContent);

module.exports = router;
