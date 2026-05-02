const openai  = require("../utils/openai");
const process = require("process");

// ── Shared: call Ollama via OpenAI-compatible API ──
async function chat(systemPrompt, userPrompt) {
  const response = await openai.chat.completions.create({
    model:       process.env.OLLAMA_MODEL || "llama3.1:8b",
    messages:    [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt   }
    ],
    temperature: 0.7,
    max_tokens:  400
  });
  return response.choices[0].message.content.trim();
}

// ── POST /api/generate-summary ──
async function generateSummary(req, res) {
  const { personal, experience, skills } = req.body;

  if (!personal?.fullName) {
    return res.status(400).json({ error: "fullName is required" });
  }

  const userPrompt = [
    `Name: ${personal.fullName}`,
    `Skills: ${skills?.technical || "N/A"}`,
    `Experience: ${(experience || []).map(e => `${e.title} at ${e.company} (${e.duration})`).join(", ") || "N/A"}`,
    "",
    "Write a 3-sentence professional resume summary. Be concise, use active voice, highlight strengths."
  ].join("\n");

  try {
    const summary = await chat(
      "You are an expert resume writer. Write professional, ATS-optimized resume summaries.",
      userPrompt
    );
    res.json({ summary });
  } catch (err) {
    console.error("generate-summary error:", err.message);
    res.status(500).json({ error: "Failed to generate summary." });
  }
}

// ── POST /api/improve-content ──
async function improveContent(req, res) {
  const { type, content } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({ error: "content is required" });
  }

  const PROMPTS = {
    bullets: {
      system: "You are an expert resume writer. Improve bullet points to be impactful, quantified, and ATS-friendly.",
      user:   `Improve these resume bullet points. Return only the improved bullets, one per line starting with •:\n\n${content}`
    },
    description: {
      system: "You are an expert resume writer. Improve project descriptions to be concise and impactful.",
      user:   `Improve this project description for a resume. Return only the improved description:\n\n${content}`
    }
  };

  const prompt = PROMPTS[type] || PROMPTS.bullets;

  try {
    const improved = await chat(prompt.system, prompt.user);
    res.json({ improved });
  } catch (err) {
    console.error("improve-content error:", err.message);
    res.status(500).json({ error: "Failed to improve content." });
  }
}

module.exports = { generateSummary, improveContent };
