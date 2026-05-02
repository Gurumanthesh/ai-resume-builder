const OpenAI = require("openai");

// Using Ollama's OpenAI-compatible local API
const openai = new OpenAI({
  apiKey:  "ollama",  // Ollama doesn't need a real key
  baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1"
});

module.exports = openai;
