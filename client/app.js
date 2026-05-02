// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const TOTAL_STEPS   = 5;
const STORAGE_KEY   = 'resumeData';
let   currentStep   = 1;

// ─────────────────────────────────────────────
// Security: sanitize all user input before
// injecting into innerHTML to prevent XSS
// ─────────────────────────────────────────────
function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ─────────────────────────────────────────────
// Toast Notification (replaces alert())
// ─────────────────────────────────────────────
function showToast(message, type = 'success') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
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
// Performance: debounce preview rendering
// ─────────────────────────────────────────────
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ─────────────────────────────────────────────
// Step Navigation
// ─────────────────────────────────────────────
function changeStep(direction) {
  saveToLocalStorage();

  const prev = currentStep;
  currentStep = Math.min(Math.max(currentStep + direction, 1), TOTAL_STEPS);

  document.getElementById(`step-${prev}`).classList.remove('active');
  document.getElementById(`step-${currentStep}`).classList.add('active');

  document.querySelectorAll('.steps-indicator .step').forEach(el => {
    const n = parseInt(el.dataset.step);
    el.classList.toggle('active',    n === currentStep);
    el.classList.toggle('completed', n < currentStep);
  });

  document.getElementById('btn-back').style.display   = currentStep > 1            ? 'inline-flex' : 'none';
  document.getElementById('btn-next').style.display   = currentStep < TOTAL_STEPS  ? 'inline-flex' : 'none';
  document.getElementById('btn-submit').style.display = currentStep === TOTAL_STEPS ? 'inline-flex' : 'none';

  renderPreview();
}

// ─────────────────────────────────────────────
// Dynamic Entry Builder (DOM API — no innerHTML)
// ─────────────────────────────────────────────
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  });
  children.forEach(c => c && node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return node;
}

function makeFormGroup(labelText, inputAttrs) {
  const group = el('div', { class: 'form-group' });
  group.appendChild(el('label', { text: labelText }));
  const tag    = inputAttrs.rows ? 'textarea' : 'input';
  const input  = el(tag, inputAttrs);
  group.appendChild(input);
  return { group, input };
}

function makeAIButton(text, handler) {
  const btn = el('button', { type: 'button', class: 'btn-ai' , text });
  btn.addEventListener('click', () => handler(btn));
  return btn;
}

function makeRemoveButton(entry) {
  const btn = el('button', { type: 'button', class: 'btn-remove', text: '✕' });
  btn.addEventListener('click', () => { entry.remove(); renderPreview(); });
  return btn;
}

function buildEducationEntry(i) {
  const entry = el('div', { class: 'dynamic-entry', 'data-index': i });
  const grid  = el('div', { class: 'form-grid' });
  entry.appendChild(makeRemoveButton(entry));
  [['Degree','edu-degree','B.Sc. Computer Science'],
   ['Institution','edu-institution','MIT'],
   ['Year','edu-year','2020 – 2024'],
   ['GPA (optional)','edu-gpa','3.8 / 4.0']
  ].forEach(([label, cls, ph]) => {
    const { group } = makeFormGroup(label, { type:'text', class: cls, placeholder: ph });
    grid.appendChild(group);
  });
  entry.appendChild(grid);
  return entry;
}

function buildExperienceEntry(i) {
  const entry = el('div', { class: 'dynamic-entry', 'data-index': i });
  const grid  = el('div', { class: 'form-grid' });
  entry.appendChild(makeRemoveButton(entry));
  [['Job Title','exp-title','Software Engineer'],
   ['Company','exp-company','Google'],
   ['Duration','exp-duration','Jan 2022 – Present'],
   ['Location','exp-location','Remote / City']
  ].forEach(([label, cls, ph]) => {
    const { group } = makeFormGroup(label, { type:'text', class: cls, placeholder: ph });
    grid.appendChild(group);
  });
  entry.appendChild(grid);
  const { group: bGroup, input: bInput } = makeFormGroup(
    'Responsibilities / Achievements',
    { class: 'exp-bullets', rows: '4', placeholder: '• Built REST APIs that reduced latency by 30%\n• Led a team of 4 engineers...' }
  );
  bGroup.appendChild(makeAIButton('✨ Improve Bullets', improveBullets));
  entry.appendChild(bGroup);
  return entry;
}

function buildProjectEntry(i) {
  const entry = el('div', { class: 'dynamic-entry', 'data-index': i });
  const grid  = el('div', { class: 'form-grid' });
  entry.appendChild(makeRemoveButton(entry));
  [['Project Name','proj-name','AI Resume Builder'],
   ['Tech Stack','proj-tech','Node.js, React, OpenAI'],
   ['Live URL (optional)','proj-url','https://...'],
   ['GitHub URL (optional)','proj-github','https://github.com/...']
  ].forEach(([label, cls, ph]) => {
    const type = cls.includes('url') ? 'url' : 'text';
    const { group } = makeFormGroup(label, { type, class: cls, placeholder: ph });
    grid.appendChild(group);
  });
  entry.appendChild(grid);
  const { group: dGroup } = makeFormGroup(
    'Description',
    { class: 'proj-desc', rows: '3', placeholder: 'Describe what the project does and your role...' }
  );
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
    education: [...document.querySelectorAll('#education-list .dynamic-entry')].map(el => ({
      degree:      el.querySelector('.edu-degree')?.value.trim()      || '',
      institution: el.querySelector('.edu-institution')?.value.trim() || '',
      year:        el.querySelector('.edu-year')?.value.trim()        || '',
      gpa:         el.querySelector('.edu-gpa')?.value.trim()         || ''
    })),
    skills: {
      technical: document.getElementById('technicalSkills')?.value.trim() || '',
      soft:      document.getElementById('softSkills')?.value.trim()      || '',
      languages: document.getElementById('languages')?.value.trim()       || ''
    },
    experience: [...document.querySelectorAll('#experience-list .dynamic-entry')].map(el => ({
      title:    el.querySelector('.exp-title')?.value.trim()    || '',
      company:  el.querySelector('.exp-company')?.value.trim()  || '',
      duration: el.querySelector('.exp-duration')?.value.trim() || '',
      location: el.querySelector('.exp-location')?.value.trim() || '',
      bullets:  el.querySelector('.exp-bullets')?.value.trim()  || ''
    })),
    projects: [...document.querySelectorAll('#projects-list .dynamic-entry')].map(el => ({
      name:   el.querySelector('.proj-name')?.value.trim()   || '',
      tech:   el.querySelector('.proj-tech')?.value.trim()   || '',
      url:    el.querySelector('.proj-url')?.value.trim()    || '',
      github: el.querySelector('.proj-github')?.value.trim() || '',
      desc:   el.querySelector('.proj-desc')?.value.trim()   || ''
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
      const el = document.getElementById(id);
      if (el && p[id]) el.value = p[id];
    });

    const s = data.skills || {};
    if (s.technical) document.getElementById('technicalSkills').value = s.technical;
    if (s.soft)      document.getElementById('softSkills').value      = s.soft;
    if (s.languages) document.getElementById('languages').value       = s.languages;

    (data.education || []).forEach((edu, i) => {
      if (i > 0) addEntry('education');
      const el = document.querySelectorAll('#education-list .dynamic-entry')[i];
      if (!el) return;
      el.querySelector('.edu-degree').value      = edu.degree      || '';
      el.querySelector('.edu-institution').value = edu.institution || '';
      el.querySelector('.edu-year').value        = edu.year        || '';
      el.querySelector('.edu-gpa').value         = edu.gpa         || '';
    });

    (data.experience || []).forEach((exp, i) => {
      if (i > 0) addEntry('experience');
      const el = document.querySelectorAll('#experience-list .dynamic-entry')[i];
      if (!el) return;
      el.querySelector('.exp-title').value    = exp.title    || '';
      el.querySelector('.exp-company').value  = exp.company  || '';
      el.querySelector('.exp-duration').value = exp.duration || '';
      el.querySelector('.exp-location').value = exp.location || '';
      el.querySelector('.exp-bullets').value  = exp.bullets  || '';
    });

    (data.projects || []).forEach((proj, i) => {
      if (i > 0) addEntry('projects');
      const el = document.querySelectorAll('#projects-list .dynamic-entry')[i];
      if (!el) return;
      el.querySelector('.proj-name').value   = proj.name   || '';
      el.querySelector('.proj-tech').value   = proj.tech   || '';
      el.querySelector('.proj-url').value    = proj.url    || '';
      el.querySelector('.proj-github').value = proj.github || '';
      el.querySelector('.proj-desc').value   = proj.desc   || '';
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
  const data = collectFormData();
  const p    = data.personal;
  const container = document.getElementById('resume-preview');

  if (!p.fullName) {
    container.innerHTML = `<div class="preview-placeholder"><p>👆 Start filling the form to see your resume here</p></div>`;
    return;
  }

  const contactParts = [
    p.email    ? `<a href="mailto:${sanitize(p.email)}">${sanitize(p.email)}</a>` : '',
    p.phone    ? `<span>${sanitize(p.phone)}</span>` : '',
    p.location ? `<span>${sanitize(p.location)}</span>` : '',
    p.linkedin ? `<a href="${sanitize(p.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>` : '',
    p.github   ? `<a href="${sanitize(p.github)}" target="_blank" rel="noopener">GitHub</a>` : ''
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
    data.skills.soft      ? `<div class="rv-skill-row"><strong>Soft Skills:</strong> ${sanitize(data.skills.soft)}</div>`      : '',
    data.skills.languages ? `<div class="rv-skill-row"><strong>Languages:</strong> ${sanitize(data.skills.languages)}</div>`   : ''
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
            ${pr.url    ? `<a href="${sanitize(pr.url)}"    target="_blank" rel="noopener">Live</a>` : ''}
            ${pr.github ? `<a href="${sanitize(pr.github)}" target="_blank" rel="noopener">GitHub</a>` : ''}
          </div>` : ''}
        ${renderBullets(pr.desc)}
      </div>`).join('');

  const summaryText = document.getElementById('aiSummary')?.value.trim();

  container.innerHTML = `
    <div class="resume-doc" id="resume-doc">
      <div class="rv-name">${sanitize(p.fullName)}</div>
      <div class="rv-contact">${contactParts}</div>
      ${summaryText ? `<div class="rv-section"><div class="rv-section-title">Summary</div><p class="rv-summary">${sanitize(summaryText)}</p></div>` : ''}
      ${eduHTML    ? `<div class="rv-section"><div class="rv-section-title">Education</div>${eduHTML}</div>`                                   : ''}
      ${skillsHTML ? `<div class="rv-section"><div class="rv-section-title">Skills</div><div class="rv-skills-grid">${skillsHTML}</div></div>` : ''}
      ${expHTML    ? `<div class="rv-section"><div class="rv-section-title">Experience</div>${expHTML}</div>`                                  : ''}
      ${projHTML   ? `<div class="rv-section"><div class="rv-section-title">Projects</div>${projHTML}</div>`                                   : ''}
    </div>`;
}

const debouncedRender = debounce(() => {
  saveToLocalStorage();
  renderPreview();
}, 150);

// ─────────────────────────────────────────────
// AI Loading State Helper
// ─────────────────────────────────────────────
function setButtonLoading(btn, loading) {
  btn.disabled = loading;
  btn.dataset.original = btn.dataset.original || btn.textContent;
  btn.textContent = loading ? '⏳ Thinking...' : btn.dataset.original;
}

// ─────────────────────────────────────────────
// AI: Generate Professional Summary
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
// AI: Improve Bullet Points
// ─────────────────────────────────────────────
async function improveBullets(btn) {
  const textarea = btn.previousElementSibling;
  if (!textarea?.value.trim()) {
    showToast('Please enter some bullet points first', 'error');
    return;
  }

  setButtonLoading(btn, true);
  try {
    const { improved } = await callAPI('improve-content', {
      type:    'bullets',
      content: textarea.value
    });
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
// AI: Improve Project Description
// ─────────────────────────────────────────────
async function improveDescription(btn) {
  const textarea = btn.previousElementSibling;
  if (!textarea?.value.trim()) {
    showToast('Please enter a description first', 'error');
    return;
  }

  setButtonLoading(btn, true);
  try {
    const { improved } = await callAPI('improve-content', {
      type:    'description',
      content: textarea.value
    });
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
// API Helper (CSRF-protected, relative URLs only)
// ─────────────────────────────────────────────
let csrfToken = null;

async function initCSRF() {
  try {
    const res  = await fetch('/api/csrf-token');
    const data = await res.json();
    csrfToken  = data.token;
  } catch (e) {
    console.warn('CSRF token fetch failed:', e);
  }
}

// Only allow relative API paths to prevent SSRF
const ALLOWED_ENDPOINTS = Object.freeze(['generate-summary', 'improve-content']);
const API_BASE          = '/api'; // never interpolated from user input

async function initCSRF() {
  try {
    const res  = await fetch(API_BASE + '/csrf-token');
    const data = await res.json();
    csrfToken  = data.token;
  } catch (e) {
    console.warn('CSRF token fetch failed:', e);
  }
}

async function callAPI(endpoint, body) {
  if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
    throw new Error('Invalid API endpoint');
  }
  const url = API_BASE + '/' + endpoint; // always relative, never user-controlled
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
// Submit
// ─────────────────────────────────────────────
function submitForm() {
  saveToLocalStorage();
  showToast('Resume saved! PDF export coming in Phase 6 ✅');
}

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
document.getElementById('resume-form').addEventListener('input', debouncedRender);
initCSRF();
loadFromLocalStorage();
renderPreview();
