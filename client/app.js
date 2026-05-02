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
// Dynamic Entry Templates
// ─────────────────────────────────────────────
const ENTRY_TEMPLATES = {
  education: (i) => `
    <div class="dynamic-entry" data-index="${i}">
      <button type="button" class="btn-remove" onclick="removeEntry(this)">✕</button>
      <div class="form-grid">
        <div class="form-group"><label>Degree</label><input type="text" class="edu-degree" placeholder="B.Sc. Computer Science" /></div>
        <div class="form-group"><label>Institution</label><input type="text" class="edu-institution" placeholder="MIT" /></div>
        <div class="form-group"><label>Year</label><input type="text" class="edu-year" placeholder="2020 – 2024" /></div>
        <div class="form-group"><label>GPA (optional)</label><input type="text" class="edu-gpa" placeholder="3.8 / 4.0" /></div>
      </div>
    </div>`,

  experience: (i) => `
    <div class="dynamic-entry" data-index="${i}">
      <button type="button" class="btn-remove" onclick="removeEntry(this)">✕</button>
      <div class="form-grid">
        <div class="form-group"><label>Job Title</label><input type="text" class="exp-title" placeholder="Software Engineer" /></div>
        <div class="form-group"><label>Company</label><input type="text" class="exp-company" placeholder="Google" /></div>
        <div class="form-group"><label>Duration</label><input type="text" class="exp-duration" placeholder="Jan 2022 – Present" /></div>
        <div class="form-group"><label>Location</label><input type="text" class="exp-location" placeholder="Remote / City" /></div>
      </div>
      <div class="form-group"><label>Responsibilities / Achievements</label>
        <textarea class="exp-bullets" rows="4" placeholder="• Built REST APIs that reduced latency by 30%&#10;• Led a team of 4 engineers..."></textarea>
      </div>
    </div>`,

  projects: (i) => `
    <div class="dynamic-entry" data-index="${i}">
      <button type="button" class="btn-remove" onclick="removeEntry(this)">✕</button>
      <div class="form-grid">
        <div class="form-group"><label>Project Name</label><input type="text" class="proj-name" placeholder="AI Resume Builder" /></div>
        <div class="form-group"><label>Tech Stack</label><input type="text" class="proj-tech" placeholder="Node.js, React, OpenAI" /></div>
        <div class="form-group"><label>Live URL (optional)</label><input type="url" class="proj-url" placeholder="https://..." /></div>
        <div class="form-group"><label>GitHub URL (optional)</label><input type="url" class="proj-github" placeholder="https://github.com/..." /></div>
      </div>
      <div class="form-group"><label>Description</label>
        <textarea class="proj-desc" rows="3" placeholder="Describe what the project does and your role..."></textarea>
      </div>
    </div>`
};

function addEntry(type) {
  const listId = `${type === 'education' ? 'education' : type === 'experience' ? 'experience' : 'projects'}-list`;
  const list   = document.getElementById(listId);
  list.insertAdjacentHTML('beforeend', ENTRY_TEMPLATES[type](list.children.length));
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

  container.innerHTML = `
    <div class="resume-doc" id="resume-doc">
      <div class="rv-name">${sanitize(p.fullName)}</div>
      <div class="rv-contact">${contactParts}</div>
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
// API Helper
// ─────────────────────────────────────────────
async function callAPI(endpoint, body) {
  const res = await fetch(`/api/${endpoint}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
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
loadFromLocalStorage();
renderPreview();
