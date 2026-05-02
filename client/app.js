// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const TOTAL_STEPS              = 5;
const STORAGE_KEY              = 'resumeData';
const ALLOWED_ENDPOINTS        = Object.freeze(['generate-summary', 'improve-content']);
const API_BASE                 = '/api';
let   currentStep              = 1;
let   csrfToken                = null;

// ─────────────────────────────────────────────
// Sanitize — prevent XSS in innerHTML
// ─────────────────────────────────────────────
function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ─────────────────────────────────────────────
// Toast Notification
// ─────────────────────────────────────────────
function showToast(message, type = 'success') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id        = 'toast';
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─────────────────────────────────────────────
// Debounce
// ─────────────────────────────────────────────
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ─────────────────────────────────────────────
// CSRF + API Helper
// ─────────────────────────────────────────────
async function initCSRF() {
  try {
    // Use window.location.origin to ensure request stays on same origin
    const origin = window.location.origin;
    const res    = await fetch(origin + API_BASE + '/csrf-token');
    const data   = await res.json();
    csrfToken    = data.token;
  } catch (e) {
    console.warn('CSRF token fetch failed:', e);
  }
}

async function callAPI(endpoint, body) {
  if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
    throw new Error('Invalid API endpoint');
  }
  const url = API_BASE + '/' + endpoint;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken || ''
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API request failed');
  return data;
}

// ─────────────────────────────────────────────
// Form Validation
// ─────────────────────────────────────────────
function validateStep(step) {
  if (step === 1) {
    const name  = document.getElementById('fullName')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    if (!name)  { showToast('Please enter your full name', 'error');  return false; }
    if (!email) { showToast('Please enter your email', 'error');       return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Please enter a valid email address', 'error');
      return false;
    }
  }
  return true;
}

// ─────────────────────────────────────────────
// Progress Bar
// ─────────────────────────────────────────────
function updateProgress() {
  const data    = collectFormData();
  const checks  = [
    data.personal.fullName,
    data.personal.email,
    data.personal.phone,
    data.education.some(e => e.degree),
    data.skills.technical,
    data.experience.some(e => e.title),
    data.projects.some(p => p.name),
    document.getElementById('aiSummary')?.value.trim()
  ];
  const pct  = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const bar  = document.getElementById('progress-bar');
  const label = document.getElementById('progress-label');
  if (bar)   bar.style.width   = pct + '%';
  if (label) label.textContent = pct + '% Complete';
}

// ─────────────────────────────────────────────
// Step Navigation
// ─────────────────────────────────────────────
function changeStep(direction) {
  if (direction > 0 && !validateStep(currentStep)) return;

  saveToLocalStorage();

  const prev = currentStep;
  currentStep = Math.min(Math.max(currentStep + direction, 1), TOTAL_STEPS);

  document.getElementById(`step-${prev}`).classList.remove('active');
  document.getElementById(`step-${currentStep}`).classList.add('active');

  document.querySelectorAll('.steps-indicator .step').forEach(node => {
    const n = parseInt(node.dataset.step);
    node.classList.toggle('active',    n === currentStep);
    node.classList.toggle('completed', n < currentStep);
  });

  document.getElementById('btn-back').style.display   = currentStep > 1            ? 'inline-flex' : 'none';
  document.getElementById('btn-next').style.display   = currentStep < TOTAL_STEPS  ? 'inline-flex' : 'none';
  document.getElementById('btn-submit').style.display = currentStep === TOTAL_STEPS ? 'inline-flex' : 'none';

  updateProgress();
  renderPreview();
}

// ─────────────────────────────────────────────
// DOM Builder Helpers (no innerHTML / no XSS)
// ─────────────────────────────────────────────
function createElement(tag, attrs = {}) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if      (k === 'class') node.className   = v;
    else if (k === 'text')  node.textContent = v;
    else                    node.setAttribute(k, v);
  });
  return node;
}

function makeFormGroup(labelText, inputAttrs) {
  const group = createElement('div', { class: 'form-group' });
  group.appendChild(createElement('label', { text: labelText }));
  const tag   = inputAttrs.rows ? 'textarea' : 'input';
  const input = createElement(tag, inputAttrs);
  group.appendChild(input);
  return { group, input };
}

function makeAIButton(text, handler) {
  const btn = createElement('button', { type: 'button', class: 'btn-ai', text });
  btn.addEventListener('click', () => handler(btn));
  return btn;
}

function makeRemoveButton(entry) {
  const btn = createElement('button', { type: 'button', class: 'btn-remove', text: '✕' });
  btn.addEventListener('click', () => { entry.remove(); renderPreview(); });
  return btn;
}

function buildEducationEntry(i) {
  const entry = createElement('div', { class: 'dynamic-entry', 'data-index': i });
  const grid  = createElement('div', { class: 'form-grid' });
  entry.appendChild(makeRemoveButton(entry));
  [
    ['Degree',         'edu-degree',      'B.Sc. Computer Science'],
    ['Institution',    'edu-institution', 'MIT'],
    ['Year',           'edu-year',        '2020 – 2024'],
    ['GPA (optional)', 'edu-gpa',         '3.8 / 4.0']
  ].forEach(([label, cls, ph]) => {
    const { group } = makeFormGroup(label, { type: 'text', class: cls, placeholder: ph });
    grid.appendChild(group);
  });
  entry.appendChild(grid);
  return entry;
}

function buildExperienceEntry(i) {
  const entry = createElement('div', { class: 'dynamic-entry', 'data-index': i });
  const grid  = createElement('div', { class: 'form-grid' });
  entry.appendChild(makeRemoveButton(entry));
  [
    ['Job Title', 'exp-title',    'Software Engineer'],
    ['Company',   'exp-company',  'Google'],
    ['Duration',  'exp-duration', 'Jan 2022 – Present'],
    ['Location',  'exp-location', 'Remote / City']
  ].forEach(([label, cls, ph]) => {
    const { group } = makeFormGroup(label, { type: 'text', class: cls, placeholder: ph });
    grid.appendChild(group);
  });
  entry.appendChild(grid);
  const { group: bGroup } = makeFormGroup('Responsibilities / Achievements', {
    class: 'exp-bullets', rows: '4',
    placeholder: '• Built REST APIs that reduced latency by 30%\n• Led a team of 4 engineers...'
  });
  bGroup.appendChild(makeAIButton('✨ Improve Bullets', improveBullets));
  entry.appendChild(bGroup);
  return entry;
}

function buildProjectEntry(i) {
  const entry = createElement('div', { class: 'dynamic-entry', 'data-index': i });
  const grid  = createElement('div', { class: 'form-grid' });
  entry.appendChild(makeRemoveButton(entry));
  [
    ['Project Name',           'proj-name',   'AI Resume Builder'],
    ['Tech Stack',             'proj-tech',   'Node.js, React, OpenAI'],
    ['Live URL (optional)',    'proj-url',    'https://...'],
    ['GitHub URL (optional)',  'proj-github', 'https://github.com/...']
  ].forEach(([label, cls, ph]) => {
    const type = cls.includes('url') ? 'url' : 'text';
    const { group } = makeFormGroup(label, { type, class: cls, placeholder: ph });
    grid.appendChild(group);
  });
  entry.appendChild(grid);
  const { group: dGroup } = makeFormGroup('Description', {
    class: 'proj-desc', rows: '3',
    placeholder: 'Describe what the project does and your role...'
  });
  dGroup.appendChild(makeAIButton('✨ Improve Description', improveDescription));
  entry.appendChild(dGroup);
  return entry;
}

const ENTRY_BUILDERS = {
  education:  buildEducationEntry,
  experience: buildExperienceEntry,
  projects:   buildProjectEntry
};

function addEntry(type) {
  const list = document.getElementById(`${type}-list`);
  list.appendChild(ENTRY_BUILDERS[type](list.children.length));
}

function removeEntry(btn) {
  btn.closest('.dynamic-entry').remove();
  renderPreview();
}

// ─────────────────────────────────────────────
// Collect Form Data
// ─────────────────────────────────────────────
function collectFormData() {
  return {
    personal: {
      fullName: document.getElementById('fullName')?.value.trim()  || '',
      email:    document.getElementById('email')?.value.trim()     || '',
      phone:    document.getElementById('phone')?.value.trim()     || '',
      location: document.getElementById('location')?.value.trim()  || '',
      linkedin: document.getElementById('linkedin')?.value.trim()  || '',
      github:   document.getElementById('github')?.value.trim()    || ''
    },
    education: [...document.querySelectorAll('#education-list .dynamic-entry')].map(node => ({
      degree:      node.querySelector('.edu-degree')?.value.trim()      || '',
      institution: node.querySelector('.edu-institution')?.value.trim() || '',
      year:        node.querySelector('.edu-year')?.value.trim()        || '',
      gpa:         node.querySelector('.edu-gpa')?.value.trim()         || ''
    })),
    skills: {
      technical: document.getElementById('technicalSkills')?.value.trim() || '',
      soft:      document.getElementById('softSkills')?.value.trim()      || '',
      languages: document.getElementById('languages')?.value.trim()       || ''
    },
    experience: [...document.querySelectorAll('#experience-list .dynamic-entry')].map(node => ({
      title:    node.querySelector('.exp-title')?.value.trim()    || '',
      company:  node.querySelector('.exp-company')?.value.trim()  || '',
      duration: node.querySelector('.exp-duration')?.value.trim() || '',
      location: node.querySelector('.exp-location')?.value.trim() || '',
      bullets:  node.querySelector('.exp-bullets')?.value.trim()  || ''
    })),
    projects: [...document.querySelectorAll('#projects-list .dynamic-entry')].map(node => ({
      name:   node.querySelector('.proj-name')?.value.trim()   || '',
      tech:   node.querySelector('.proj-tech')?.value.trim()   || '',
      url:    node.querySelector('.proj-url')?.value.trim()    || '',
      github: node.querySelector('.proj-github')?.value.trim() || '',
      desc:   node.querySelector('.proj-desc')?.value.trim()   || ''
    }))
  };
}

// ─────────────────────────────────────────────
// LocalStorage
// ─────────────────────────────────────────────
function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collectFormData()));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const data = JSON.parse(saved);

    const p = data.personal || {};
    ['fullName','email','phone','location','linkedin','github'].forEach(id => {
      const node = document.getElementById(id);
      if (node && p[id]) node.value = p[id];
    });

    const s = data.skills || {};
    if (s.technical) document.getElementById('technicalSkills').value = s.technical;
    if (s.soft)      document.getElementById('softSkills').value      = s.soft;
    if (s.languages) document.getElementById('languages').value       = s.languages;

    (data.education || []).forEach((edu, i) => {
      if (i > 0) addEntry('education');
      const node = document.querySelectorAll('#education-list .dynamic-entry')[i];
      if (!node) return;
      node.querySelector('.edu-degree').value      = edu.degree      || '';
      node.querySelector('.edu-institution').value = edu.institution || '';
      node.querySelector('.edu-year').value        = edu.year        || '';
      node.querySelector('.edu-gpa').value         = edu.gpa         || '';
    });

    (data.experience || []).forEach((exp, i) => {
      if (i > 0) addEntry('experience');
      const node = document.querySelectorAll('#experience-list .dynamic-entry')[i];
      if (!node) return;
      node.querySelector('.exp-title').value    = exp.title    || '';
      node.querySelector('.exp-company').value  = exp.company  || '';
      node.querySelector('.exp-duration').value = exp.duration || '';
      node.querySelector('.exp-location').value = exp.location || '';
      node.querySelector('.exp-bullets').value  = exp.bullets  || '';
    });

    (data.projects || []).forEach((proj, i) => {
      if (i > 0) addEntry('projects');
      const node = document.querySelectorAll('#projects-list .dynamic-entry')[i];
      if (!node) return;
      node.querySelector('.proj-name').value   = proj.name   || '';
      node.querySelector('.proj-tech').value   = proj.tech   || '';
      node.querySelector('.proj-url').value    = proj.url    || '';
      node.querySelector('.proj-github').value = proj.github || '';
      node.querySelector('.proj-desc').value   = proj.desc   || '';
    });
  } catch (e) {
    console.warn('LocalStorage load failed:', e);
  }
}

// ─────────────────────────────────────────────
// Preview Renderer
// ─────────────────────────────────────────────
function renderBullets(text) {
  if (!text.trim()) return '';
  const items = text.split('\n')
    .map(l => l.replace(/^[•\-]\s*/, '').trim())
    .filter(Boolean)
    .map(l => `<li>${sanitize(l)}</li>`)
    .join('');
  return `<ul class="rv-bullets">${items}</ul>`;
}

function renderPreview() {
  const data      = collectFormData();
  const p         = data.personal;
  const container = document.getElementById('resume-preview');

  if (!p.fullName) {
    container.innerHTML = '<div class="preview-placeholder"><p>👆 Start filling the form to see your resume here</p></div>';
    return;
  }

  const contactParts = [
    p.email    ? `<a href="mailto:${sanitize(p.email)}">${sanitize(p.email)}</a>`                          : '',
    p.phone    ? `<span>${sanitize(p.phone)}</span>`                                                        : '',
    p.location ? `<span>${sanitize(p.location)}</span>`                                                     : '',
    p.linkedin ? `<a href="${sanitize(p.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>`            : '',
    p.github   ? `<a href="${sanitize(p.github)}"   target="_blank" rel="noopener">GitHub</a>`             : ''
  ].filter(Boolean).join('<span class="rv-sep"> · </span>');

  const eduHTML = data.education
    .filter(e => e.degree || e.institution)
    .map(e => `
      <div class="rv-entry">
        <div class="rv-row">
          <span class="rv-row-left">${sanitize(e.degree)}</span>
          <span class="rv-row-right">${sanitize(e.year)}</span>
        </div>
        <div class="rv-subtitle">${sanitize(e.institution)}${e.gpa ? ` — GPA: ${sanitize(e.gpa)}` : ''}</div>
      </div>`).join('');

  const skillsHTML = [
    data.skills.technical ? `<div class="rv-skill-row"><strong>Technical:</strong> ${sanitize(data.skills.technical)}</div>` : '',
    data.skills.soft      ? `<div class="rv-skill-row"><strong>Soft Skills:</strong> ${sanitize(data.skills.soft)}</div>`     : '',
    data.skills.languages ? `<div class="rv-skill-row"><strong>Languages:</strong> ${sanitize(data.skills.languages)}</div>`  : ''
  ].filter(Boolean).join('');

  const expHTML = data.experience
    .filter(e => e.title || e.company)
    .map(e => `
      <div class="rv-entry">
        <div class="rv-row">
          <span class="rv-row-left">${sanitize(e.title)}</span>
          <span class="rv-row-right">${sanitize(e.duration)}</span>
        </div>
        <div class="rv-subtitle">${sanitize(e.company)}${e.location ? ` — ${sanitize(e.location)}` : ''}</div>
        ${renderBullets(e.bullets)}
      </div>`).join('');

  const projHTML = data.projects
    .filter(pr => pr.name)
    .map(pr => `
      <div class="rv-entry">
        <div class="rv-row">
          <span class="rv-row-left">${sanitize(pr.name)}</span>
          <span class="rv-row-right">${sanitize(pr.tech)}</span>
        </div>
        ${pr.url || pr.github ? `
          <div class="rv-subtitle">
            ${pr.url    ? `<a href="${sanitize(pr.url)}"    target="_blank" rel="noopener">Live</a>`   : ''}
            ${pr.github ? `<a href="${sanitize(pr.github)}" target="_blank" rel="noopener">GitHub</a>` : ''}
          </div>` : ''}
        ${renderBullets(pr.desc)}
      </div>`).join('');

  const summaryText   = document.getElementById('aiSummary')?.value.trim();
  const isModern      = currentTemplate === 'modern';
  const templateClass = isModern ? 'template-modern' : 'template-classic';

  const innerContent = `
    ${isModern ? `
      <div class="rv-header-block">
        <div class="rv-name">${sanitize(p.fullName)}</div>
        <div class="rv-contact">${contactParts}</div>
      </div>
      <div class="rv-body">` : `
      <div class="rv-name">${sanitize(p.fullName)}</div>
      <div class="rv-contact">${contactParts}</div>`}
      ${summaryText ? `<div class="rv-section"><div class="rv-section-title">Summary</div><p class="rv-summary">${sanitize(summaryText)}</p></div>` : ''}
      ${eduHTML    ? `<div class="rv-section"><div class="rv-section-title">Education</div>${eduHTML}</div>`                                    : ''}
      ${skillsHTML ? `<div class="rv-section"><div class="rv-section-title">Skills</div><div class="rv-skills-grid">${skillsHTML}</div></div>`  : ''}
      ${expHTML    ? `<div class="rv-section"><div class="rv-section-title">Experience</div>${expHTML}</div>`                                   : ''}
      ${projHTML   ? `<div class="rv-section"><div class="rv-section-title">Projects</div>${projHTML}</div>`                                    : ''}
    ${isModern ? '</div>' : ''}`;

  container.innerHTML = `<div class="resume-doc ${templateClass}" id="resume-doc">${innerContent}</div>`;
}

const debouncedRender = debounce(() => {
  saveToLocalStorage();
  updateProgress();
  renderPreview();
}, 150);

// ─────────────────────────────────────────────
// AI Loading State
// ─────────────────────────────────────────────
function setButtonLoading(btn, loading) {
  btn.disabled         = loading;
  btn.dataset.original = btn.dataset.original || btn.textContent;
  btn.textContent      = loading ? '⏳ Thinking...' : btn.dataset.original;
}

// ─────────────────────────────────────────────
// AI: Generate Summary
// ─────────────────────────────────────────────
async function generateSummary() {
  const btn  = document.getElementById('btn-gen-summary');
  const data = collectFormData();

  if (!data.personal.fullName) {
    showToast('Please enter your name first', 'error');
    return;
  }

  setButtonLoading(btn, true);
  try {
    const { summary } = await callAPI('generate-summary', {
      personal:   data.personal,
      skills:     data.skills,
      experience: data.experience
    });
    document.getElementById('aiSummary').value = summary;
    renderPreview();
    showToast('Summary generated! ✨');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

// ─────────────────────────────────────────────
// AI: Improve Bullets
// ─────────────────────────────────────────────
async function improveBullets(btn) {
  const textarea = btn.previousElementSibling;
  if (!textarea?.value.trim()) {
    showToast('Please enter some bullet points first', 'error');
    return;
  }
  setButtonLoading(btn, true);
  try {
    const { improved } = await callAPI('improve-content', { type: 'bullets', content: textarea.value });
    textarea.value = improved;
    renderPreview();
    showToast('Bullets improved! ✨');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

// ─────────────────────────────────────────────
// AI: Improve Description
// ─────────────────────────────────────────────
async function improveDescription(btn) {
  const textarea = btn.previousElementSibling;
  if (!textarea?.value.trim()) {
    showToast('Please enter a description first', 'error');
    return;
  }
  setButtonLoading(btn, true);
  try {
    const { improved } = await callAPI('improve-content', { type: 'description', content: textarea.value });
    textarea.value = improved;
    renderPreview();
    showToast('Description improved! ✨');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

// ─────────────────────────────────────────────
// Dark Mode
// ─────────────────────────────────────────────
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const theme  = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('btn-theme').textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('theme', theme);
}

function loadTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
}

// ─────────────────────────────────────────────
// Template Switching
// ─────────────────────────────────────────────
let currentTemplate = 'classic';

function switchTemplate(template) {
  currentTemplate = template;
  localStorage.setItem('template', template);

  document.querySelectorAll('.btn-template').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.template === template);
  });

  renderPreview();
}

function loadTemplate() {
  const saved = localStorage.getItem('template') || 'classic';
  switchTemplate(saved);
}

// ─────────────────────────────────────────────
// PDF Export
// ─────────────────────────────────────────────
async function downloadPDF() {
  const doc = document.getElementById('resume-doc');
  if (!doc) {
    showToast('Please fill in your resume first', 'error');
    return;
  }

  const btn = document.getElementById('btn-download');
  btn.disabled     = true;
  btn.textContent  = '⏳ Generating...';

  const name     = document.getElementById('fullName')?.value.trim() || 'resume';
  const filename = `${name.replace(/\s+/g, '_')}_resume.pdf`;

  const options = {
    margin:      [10, 10, 10, 10],
    filename,
    image:       { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(options).from(doc).save();
    showToast('PDF downloaded! ✅');
  } catch (err) {
    showToast('PDF generation failed', 'error');
    console.error('PDF error:', err);
  } finally {
    btn.disabled    = false;
    btn.textContent = '⬇ Download PDF';
  }
}

// ─────────────────────────────────────────────
// Submit
// ─────────────────────────────────────────────
function submitForm() {
  saveToLocalStorage();
  showToast('Resume saved! Click ⬇ Download PDF to export ✅');
}

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
document.getElementById('resume-form').addEventListener('input', debouncedRender);
loadTheme();
initCSRF();
loadFromLocalStorage();
loadTemplate();
