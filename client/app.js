// ── State ──
let currentStep = 1;
const TOTAL_STEPS = 5;

// ── Step Navigation ──
function changeStep(direction) {
  saveToLocalStorage();

  const prev = currentStep;
  currentStep += direction;

  document.getElementById(`step-${prev}`).classList.remove('active');
  document.getElementById(`step-${currentStep}`).classList.add('active');

  // Update step indicators
  const indicators = document.querySelectorAll('.steps-indicator .step');
  indicators.forEach(el => {
    const n = parseInt(el.dataset.step);
    el.classList.remove('active', 'completed');
    if (n === currentStep) el.classList.add('active');
    if (n < currentStep)   el.classList.add('completed');
  });

  // Show/hide Back button
  document.getElementById('btn-back').style.display = currentStep > 1 ? 'inline-block' : 'none';

  // Show Next or Submit on last step
  document.getElementById('btn-next').style.display   = currentStep < TOTAL_STEPS ? 'inline-block' : 'none';
  document.getElementById('btn-submit').style.display = currentStep === TOTAL_STEPS ? 'inline-block' : 'none';
}

// ── Dynamic Entry: Add ──
function addEntry(type) {
  const configs = {
    education: {
      listId: 'education-list',
      html: (i) => `
        <div class="dynamic-entry" data-index="${i}">
          <button type="button" class="btn-remove" onclick="removeEntry(this)">✕ Remove</button>
          <div class="form-grid">
            <div class="form-group"><label>Degree</label><input type="text" class="edu-degree" placeholder="B.Sc. Computer Science" /></div>
            <div class="form-group"><label>Institution</label><input type="text" class="edu-institution" placeholder="MIT" /></div>
            <div class="form-group"><label>Year</label><input type="text" class="edu-year" placeholder="2020 - 2024" /></div>
            <div class="form-group"><label>GPA (optional)</label><input type="text" class="edu-gpa" placeholder="3.8 / 4.0" /></div>
          </div>
        </div>`
    },
    experience: {
      listId: 'experience-list',
      html: (i) => `
        <div class="dynamic-entry" data-index="${i}">
          <button type="button" class="btn-remove" onclick="removeEntry(this)">✕ Remove</button>
          <div class="form-grid">
            <div class="form-group"><label>Job Title</label><input type="text" class="exp-title" placeholder="Software Engineer" /></div>
            <div class="form-group"><label>Company</label><input type="text" class="exp-company" placeholder="Google" /></div>
            <div class="form-group"><label>Duration</label><input type="text" class="exp-duration" placeholder="Jan 2022 - Present" /></div>
            <div class="form-group"><label>Location</label><input type="text" class="exp-location" placeholder="Remote / City" /></div>
          </div>
          <div class="form-group"><label>Responsibilities / Achievements</label>
            <textarea class="exp-bullets" rows="4" placeholder="• Built REST APIs..."></textarea>
          </div>
        </div>`
    },
    projects: {
      listId: 'projects-list',
      html: (i) => `
        <div class="dynamic-entry" data-index="${i}">
          <button type="button" class="btn-remove" onclick="removeEntry(this)">✕ Remove</button>
          <div class="form-grid">
            <div class="form-group"><label>Project Name</label><input type="text" class="proj-name" placeholder="AI Resume Builder" /></div>
            <div class="form-group"><label>Tech Stack</label><input type="text" class="proj-tech" placeholder="Node.js, React, OpenAI" /></div>
            <div class="form-group"><label>Live URL (optional)</label><input type="url" class="proj-url" placeholder="https://..." /></div>
            <div class="form-group"><label>GitHub URL (optional)</label><input type="url" class="proj-github" placeholder="https://github.com/..." /></div>
          </div>
          <div class="form-group"><label>Description</label>
            <textarea class="proj-desc" rows="3" placeholder="Describe what the project does..."></textarea>
          </div>
        </div>`
    }
  };

  const config = configs[type];
  const list = document.getElementById(config.listId);
  const index = list.children.length;
  list.insertAdjacentHTML('beforeend', config.html(index));
}

// ── Dynamic Entry: Remove ──
function removeEntry(btn) {
  btn.closest('.dynamic-entry').remove();
}

// ── Collect Form Data ──
function collectFormData() {
  // Education
  const education = [...document.querySelectorAll('#education-list .dynamic-entry')].map(el => ({
    degree:      el.querySelector('.edu-degree')?.value || '',
    institution: el.querySelector('.edu-institution')?.value || '',
    year:        el.querySelector('.edu-year')?.value || '',
    gpa:         el.querySelector('.edu-gpa')?.value || ''
  }));

  // Experience
  const experience = [...document.querySelectorAll('#experience-list .dynamic-entry')].map(el => ({
    title:    el.querySelector('.exp-title')?.value || '',
    company:  el.querySelector('.exp-company')?.value || '',
    duration: el.querySelector('.exp-duration')?.value || '',
    location: el.querySelector('.exp-location')?.value || '',
    bullets:  el.querySelector('.exp-bullets')?.value || ''
  }));

  // Projects
  const projects = [...document.querySelectorAll('#projects-list .dynamic-entry')].map(el => ({
    name:   el.querySelector('.proj-name')?.value || '',
    tech:   el.querySelector('.proj-tech')?.value || '',
    url:    el.querySelector('.proj-url')?.value || '',
    github: el.querySelector('.proj-github')?.value || '',
    desc:   el.querySelector('.proj-desc')?.value || ''
  }));

  return {
    personal: {
      fullName:  document.getElementById('fullName')?.value || '',
      email:     document.getElementById('email')?.value || '',
      phone:     document.getElementById('phone')?.value || '',
      location:  document.getElementById('location')?.value || '',
      linkedin:  document.getElementById('linkedin')?.value || '',
      github:    document.getElementById('github')?.value || ''
    },
    education,
    skills: {
      technical: document.getElementById('technicalSkills')?.value || '',
      soft:      document.getElementById('softSkills')?.value || '',
      languages: document.getElementById('languages')?.value || ''
    },
    experience,
    projects
  };
}

// ── LocalStorage: Save ──
function saveToLocalStorage() {
  localStorage.setItem('resumeData', JSON.stringify(collectFormData()));
}

// ── LocalStorage: Load ──
function loadFromLocalStorage() {
  const saved = localStorage.getItem('resumeData');
  if (!saved) return;
  const data = JSON.parse(saved);

  // Personal
  const p = data.personal || {};
  ['fullName','email','phone','location','linkedin','github'].forEach(id => {
    const el = document.getElementById(id);
    if (el && p[id]) el.value = p[id];
  });

  // Skills
  const s = data.skills || {};
  if (s.technical) document.getElementById('technicalSkills').value = s.technical;
  if (s.soft)      document.getElementById('softSkills').value = s.soft;
  if (s.languages) document.getElementById('languages').value = s.languages;

  // Education (first entry already exists in HTML)
  (data.education || []).forEach((edu, i) => {
    if (i > 0) addEntry('education');
    const entries = document.querySelectorAll('#education-list .dynamic-entry');
    const el = entries[i];
    if (!el) return;
    el.querySelector('.edu-degree').value      = edu.degree || '';
    el.querySelector('.edu-institution').value = edu.institution || '';
    el.querySelector('.edu-year').value        = edu.year || '';
    el.querySelector('.edu-gpa').value         = edu.gpa || '';
  });

  // Experience
  (data.experience || []).forEach((exp, i) => {
    if (i > 0) addEntry('experience');
    const entries = document.querySelectorAll('#experience-list .dynamic-entry');
    const el = entries[i];
    if (!el) return;
    el.querySelector('.exp-title').value    = exp.title || '';
    el.querySelector('.exp-company').value  = exp.company || '';
    el.querySelector('.exp-duration').value = exp.duration || '';
    el.querySelector('.exp-location').value = exp.location || '';
    el.querySelector('.exp-bullets').value  = exp.bullets || '';
  });

  // Projects
  (data.projects || []).forEach((proj, i) => {
    if (i > 0) addEntry('projects');
    const entries = document.querySelectorAll('#projects-list .dynamic-entry');
    const el = entries[i];
    if (!el) return;
    el.querySelector('.proj-name').value  = proj.name || '';
    el.querySelector('.proj-tech').value  = proj.tech || '';
    el.querySelector('.proj-url').value   = proj.url || '';
    el.querySelector('.proj-github').value = proj.github || '';
    el.querySelector('.proj-desc').value  = proj.desc || '';
  });
}

// ── Submit ──
function submitForm() {
  saveToLocalStorage();
  alert('Resume data saved! Preview coming in Phase 3 ✅');
}

// ── Auto-save on input ──
document.getElementById('resume-form').addEventListener('input', saveToLocalStorage);

// ── Init ──
loadFromLocalStorage();
