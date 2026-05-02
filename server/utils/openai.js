const OpenAI = require("openai");

// Ollama API key is configurable via env (defaults to "ollama" for local use)
const openai = new OpenAI({
  apiKey:  process.env.OLLAMA_API_KEY || "ollama",
  baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1"
});

module.exports = openai;
