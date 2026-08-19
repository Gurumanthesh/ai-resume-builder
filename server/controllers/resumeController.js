const openai = require('../utils/openai');

// Prompt version — increment when prompts change; logged with every request for traceability
const PROMPT_VERSION = 'v4';

// Per-type input length caps
const MAX_LENGTH = {
  bullets:     1500,
  description:  800,
  summary:     2000   // personal + skills + experience combined
};

// Count sentences robustly — a sentence boundary is [.!?] where:
//   - for '.' : preceded by 2+ word chars (rules out A. B. C. single-letter abbrevs)
//   - followed by whitespace+uppercase or end-of-string
function countSentences(text) {
  const boundaries = text.match(/(?<=\w{2,})[.!?](?=\s+[A-Z]|\s*$)|[!?](?=\s+[A-Z]|\s*$)/g);
  return boundaries ? boundaries.length : (text.trim().length > 0 ? 1 : 0);
}

// Strip AI preamble/filler from the START of output only — no global replacements
function cleanOutput(text) {
  return text
    .replace(/^(sure[!,.]?|here (are|is|you go)[^\n]*|absolutely[!,.]?|of course[!,.]?)\s*/i, '')
    .replace(/^(improved (version|bullets|description|summary)\s*[:\-]?\s*)/i, '')
    .replace(/^(here's the (improved|rewritten|updated)[^\n]*)\s*/i, '')
    .trim();
}

// Strip newlines/control chars from user strings before prompt interpolation
// Prevents prompt injection via multi-line form field values
function sanitizeForPrompt(str) {
  return String(str || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 200);
}

function getTechnicalSkills(technical) {
  if (Array.isArray(technical)) {
    return technical.flatMap(entry => String(entry?.skills || '').split(','));
  }
  return String(technical || '').split(',');
}

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

  const topSkills = getTechnicalSkills(skills?.technical).slice(0, 8)
    .map(s => sanitizeForPrompt(s)).join(', ') || 'N/A';
  const expLines  = (experience || [])
    .filter(e => e.title || e.company)
    .slice(0, 4)
    .map(e => `- ${sanitizeForPrompt(e.title || 'Role')} at ${sanitizeForPrompt(e.company || 'Company')} (${sanitizeForPrompt(e.duration || 'N/A')})`)
    .join('\n') || '- No experience listed';

  const systemPrompt =
    'You are a professional resume writer specializing in ATS-optimized resumes. ' +
    'Output ONLY plain text — no markdown, no headings, no bullet points, no explanations.';

  const userPrompt = [
    `Candidate: ${personal.fullName}`,
    `Key Skills: ${topSkills}`,
    `Experience:\n${expLines}`,
    '',
    'Write a 3-sentence ATS-optimized professional summary.',
    'Rules:',
    '- Start with a strong professional title or identity statement',
    '- Weave in relevant skills from the Key Skills list naturally — do not list them verbatim or force keywords',
    '- Use active voice and strong action-oriented language',
    '- End with a value proposition or career goal',
    '- Do NOT use first person (no I, me, my)',
    '- Do NOT invent employers, projects, certifications, awards, or achievements not present in the input',
    '- Output exactly 3 sentences of plain text — no bullet points, no headers, no markdown'
  ].join('\n');

  try {
    const raw       = await chat(systemPrompt, userPrompt, { temperature: 0.4, max_tokens: 180 });
    const sentCount = countSentences(raw);
    const retried   = sentCount > 4;

    // Output-length guard: retry once if model ignores the 3-sentence limit
    // Log both attempts so retry frequency can be monitored (point 2)
    let summary = raw;
    if (retried) {
      console.warn(`[${PROMPT_VERSION}] generate-summary: overlong output (${sentCount} sentences), retrying`);
      summary = await chat(
        systemPrompt,
        userPrompt + '\n\nCRITICAL: Output exactly 3 sentences. Stop after the third sentence.',
        { temperature: 0.2, max_tokens: 180 }
      );
    }

    console.info(`[${PROMPT_VERSION}] generate-summary ok | retried=${retried} | sentences=${sentCount}`);
    res.json({ summary });
  } catch (err) {
    console.error(`[${PROMPT_VERSION}] generate-summary error:`, err.message);
    res.status(500).json({ error: 'Failed to generate summary.' });
  }
}

// POST /api/improve-content
async function improveContent(req, res) {
  const { type, content } = req.body;

  const ALLOWED_TYPES = ['bullets', 'description'];
  if (!ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${ALLOWED_TYPES.join(', ')}` });
  }
  if (!content?.trim()) {
    return res.status(400).json({ error: 'content is required' });
  }
  const maxLen = MAX_LENGTH[type] || MAX_LENGTH.bullets;
  if (content.length > maxLen) {
    return res.status(400).json({ error: `content exceeds ${maxLen} character limit for type '${type}'` });
  }

  const PROMPTS = {
    bullets: {
      system:
        'You are a professional resume writer. ' +
        'Output ONLY plain text bullet points — no markdown, no numbering, no explanations, no preamble.',
      user: [
        'Rewrite these resume bullet points to be ATS-friendly and achievement-focused.',
        'Rules:',
        '- Start each bullet with a strong past-tense action verb (e.g. Engineered, Reduced, Led, Delivered)',
        '- Use measurable metrics only if they are present in the original content — do NOT invent numbers, percentages, or outcomes',
        '- Do NOT create technologies, responsibilities, or achievements not present in the original',
        '- Remove filler phrases (responsible for, helped with, assisted in, worked on)',
        '- Keep each bullet under 20 words',
        '- Return one bullet per line, each starting with •',
        '- Return plain text ONLY — no markdown, no headings, no explanations',
        '',
        `Original bullets:\n${content}`
      ].join('\n'),
      temperature: 0.3,
      max_tokens:  400
    },
    description: {
      system:
        'You are a professional resume writer. ' +
        'Output ONLY plain text — no markdown, no headings, no bullet points, no explanations, no preamble.',
      user: [
        'Rewrite this project description for a resume to be concise, impactful, and ATS-friendly.',
        'Rules:',
        '- Start with a strong action verb in past tense',
        '- Mention only the technologies or tools that appear in the original content',
        '- State the outcome or impact only if it is present in the original — do NOT invent metrics or results',
        '- Do NOT create features, technologies, or achievements not mentioned in the original',
        '- Keep it to 2–3 sentences of plain text — no bullet points, no markdown',
        '- Return ONLY the improved description, nothing else',
        '',
        `Original description:\n${content}`
      ].join('\n'),
      temperature: 0.4,
      max_tokens:  150
    }
  };

  const prompt = PROMPTS[type] || PROMPTS.bullets;

  try {
    const improved = await chat(prompt.system, prompt.user, {
      temperature: prompt.temperature,
      max_tokens:  prompt.max_tokens
    });
    console.info(`[${PROMPT_VERSION}] improve-content ok | type=${type}`);
    res.json({ improved });
  } catch (err) {
    console.error(`[${PROMPT_VERSION}] improve-content error | type=${type}:`, err.message);
    res.status(500).json({ error: 'Failed to improve content.' });
  }
}

module.exports = { generateSummary, improveContent };
