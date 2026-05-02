const express          = require("express");
const router           = express.Router();
const resumeController = require("../controllers/resumeController");

router.post("/generate-summary", resumeController.generateSummary);
router.post("/improve-content",  resumeController.improveContent);

module.exports = router;
