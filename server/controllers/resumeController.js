const openai = require('../utils/openai');

// Max input length — prevents prompt injection via oversized payloads
const MAX_CONTENT_LENGTH = 2000;

// Strip common AI preamble/filler that leaks into output
function cleanOutput(text) {
  return text
    .replace(/^(sure[!,.]?|here (are|is|you go)[^\n]*|absolutely[!,.]?|of course[!,.]?)[\s\n]*/i, '')
    .replace(/^(improved (version|bullets|description|summary)[:\s]*)/i, '')
    .trim();
}

// Shared: call Ollama via OpenAI-compatible API
async function chat(systemPrompt, userPrompt, { temperature = 0.4, max_tokens = 400 } = {}) {
  const response = await openai.chat.completions.create({
    model:    process.env.OLLAMA_MODEL || 'llama3.1:8b',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   }
    ],
    temperature,
    max_tokens
  });
  return cleanOutput(response.choices[0].message.content.trim());
}

// POST /api/generate-summary
async function generateSummary(req, res) {
  const { personal, experience, skills } = req.body;

  if (!personal?.fullName) {
    return res.status(400).json({ error: 'fullName is required' });
  }

  const topSkills   = (skills?.technical || '').split(',').slice(0, 8).join(', ').trim() || 'N/A';
  const expLines    = (experience || [])
    .filter(e => e.title || e.company)
    .slice(0, 4)
    .map(e => `- ${e.title || 'Role'} at ${e.company || 'Company'} (${e.duration || 'N/A'})`)
    .join('\n') || '- No experience listed';

  const systemPrompt =
    'You are a professional resume writer specializing in ATS-optimized resumes. ' +
    'Output ONLY the summary text — no labels, no preamble, no explanation.';

  const userPrompt = [
    `Candidate: ${personal.fullName}`,
    `Key Skills: ${topSkills}`,
    `Experience:\n${expLines}`,
    '',
    'Write a 3-sentence ATS-optimized professional summary.',
    'Rules:',
    '- Start with a strong professional title or identity statement',
    '- Embed the most relevant skills from the Key Skills list naturally',
    '- Use active voice and strong action-oriented language',
    '- End with a value proposition or career goal',
    '- Do NOT use first person (no I, me, my)',
    '- Output the 3 sentences only, no bullet points, no headers'
  ].join('\n');

  try {
    const summary = await chat(systemPrompt, userPrompt, { temperature: 0.4, max_tokens: 180 });
    res.json({ summary });
  } catch (err) {
    console.error('generate-summary error:', err.message);
    res.status(500).json({ error: 'Failed to generate summary.' });
  }
}

// POST /api/improve-content
async function improveContent(req, res) {
  const { type, content } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({ error: 'content is required' });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({ error: `content exceeds ${MAX_CONTENT_LENGTH} character limit` });
  }

  const PROMPTS = {
    bullets: {
      system:
        'You are a professional resume writer. Output ONLY the improved bullet points — ' +
        'no preamble, no explanation, no labels.',
      user: [
        'Rewrite these resume bullet points to be ATS-friendly and achievement-focused.',
        'Rules:',
        '- Start each bullet with a strong past-tense action verb (e.g. Engineered, Reduced, Led, Delivered)',
        '- Include metrics or quantifiable outcomes wherever possible (%, $, time, scale)',
        '- Remove filler words (responsible for, helped with, assisted in)',
        '- Keep each bullet under 20 words',
        '- Return one bullet per line, each starting with •',
        '- Return ONLY the bullets, nothing else',
        '',
        `Original bullets:\n${content}`
      ].join('\n'),
      max_tokens: 400
    },
    description: {
      system:
        'You are a professional resume writer. Output ONLY the improved project description — ' +
        'no preamble, no explanation, no labels.',
      user: [
        'Rewrite this project description for a resume to be concise, impactful, and ATS-friendly.',
        'Rules:',
        '- Start with a strong action verb in past tense',
        '- Mention the core technology or tools used',
        '- State the outcome or impact clearly',
        '- Keep it to 2–3 sentences maximum',
        '- Return ONLY the improved description, nothing else',
        '',
        `Original description:\n${content}`
      ].join('\n'),
      max_tokens: 150
    }
  };

  const prompt = PROMPTS[type] || PROMPTS.bullets;

  try {
    const improved = await chat(prompt.system, prompt.user, { temperature: 0.4, max_tokens: prompt.max_tokens });
    res.json({ improved });
  } catch (err) {
    console.error('improve-content error:', err.message);
    res.status(500).json({ error: 'Failed to improve content.' });
  }
}

module.exports = { generateSummary, improveContent };
