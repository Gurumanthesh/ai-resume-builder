const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey:  process.env.OLLAMA_API_KEY  || "ollama",
  baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1"
});

module.exports = openai;
