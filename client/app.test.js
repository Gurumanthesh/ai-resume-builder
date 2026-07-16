const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function createWindow() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously' });
  const { window } = dom;

  window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);

  const storage = {};
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem(key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
      setItem(key, value) { storage[key] = String(value); },
      removeItem(key) { delete storage[key]; }
    }
  });

  window.fetch = async () => ({
    ok: true,
    json: async () => ({ token: 'test-token' })
  });

  window.eval(fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8'));
  return { window, dom };
}

function run() {
  const { window } = createWindow();
  const savedData = {
    personal: { fullName: 'Jane Doe', email: 'jane@example.com', phone: '', location: '', linkedin: '', github: '' },
    education: [],
    skills: { technical: '', soft: '', languages: '' },
    experience: [
      { title: 'Developer', company: 'Acme', duration: '2024 - Present', location: 'Remote', bullets: 'Built features' },
      { title: 'Senior Engineer', company: 'Globex', duration: '2022 - 2024', location: 'Hybrid', bullets: 'Led workstreams' }
    ],
    projects: []
  };

  window.localStorage.setItem('resumeData', JSON.stringify(savedData));
  window.loadFromLocalStorage();
  assert.equal(window.document.querySelectorAll('#experience-list .dynamic-entry').length, 2, 'expected restored experience entries to match saved data');

  window.loadFromLocalStorage();
  assert.equal(window.document.querySelectorAll('#experience-list .dynamic-entry').length, 2, 'reloading saved data should not duplicate experience entries');

  console.log('client regression test passed');
}

run();
