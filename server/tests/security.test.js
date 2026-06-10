/**
 * Security tests — Task 5
 * Run: node server/tests/security.test.js
 * Server must be running on PORT 3000 first.
 */

const BASE = 'http://localhost:3000';
let csrfToken = null;
let passed = 0;
let failed = 0;

async function getCsrf() {
  const res  = await fetch(`${BASE}/api/csrf-token`);
  const data = await res.json();
  csrfToken  = data.token;
}

function assert(label, condition, got) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label} — got: ${JSON.stringify(got)}`);
    failed++;
  }
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken || '' },
    body:    JSON.stringify(body)
  });
  return { status: res.status, body: await res.json() };
}

// [1] safeUrl — client-side scheme validation (replicated here for unit testing)
async function testUrlSafety() {
  console.log('\n[1] safeUrl() scheme validation');
  function safeUrl(str) {
    if (!str) return '';
    try {
      const url = new URL(str);
      return (url.protocol === 'https:' || url.protocol === 'http:') ? str : '';
    } catch { return ''; }
  }
  assert('javascript:alert(1) -> empty', safeUrl('javascript:alert(1)') === '');
  assert('data:text/html,...  -> empty', safeUrl('data:text/html,<h1>x</h1>') === '');
  assert('ftp://example.com   -> empty', safeUrl('ftp://example.com') === '');
  assert('https://github.com  -> kept',  safeUrl('https://github.com') === 'https://github.com');
  assert('http://example.com  -> kept',  safeUrl('http://example.com') === 'http://example.com');
}

// [2] Unknown type -> 400
async function testUnknownType() {
  console.log('\n[2] Unknown content type -> 400');
  const r = await post('/api/improve-content', { type: 'malicious', content: 'test content' });
  assert('status 400', r.status === 400, r.status);
  assert('error message present', typeof r.body.error === 'string', r.body);
}

// [3] Missing content -> 400
async function testMissingContent() {
  console.log('\n[3] Missing content -> 400');
  const r = await post('/api/improve-content', { type: 'bullets', content: '' });
  assert('status 400', r.status === 400, r.status);
}

// [4] Content exceeding per-type limit -> 400
async function testContentTooLong() {
  console.log('\n[4] Content over description limit (800) -> 400');
  const r = await post('/api/improve-content', {
    type:    'description',
    content: 'x'.repeat(801)
  });
  assert('status 400', r.status === 400, r.status);
  assert('mentions limit', r.body.error?.includes('800'), r.body.error);
}

// [5] generate-summary with no fullName -> 400
async function testMissingFullName() {
  console.log('\n[5] generate-summary missing fullName -> 400');
  const r = await post('/api/generate-summary', { personal: {}, skills: {}, experience: [] });
  assert('status 400', r.status === 400, r.status);
}

// [6] 11th request within 1 minute -> 429
async function testRateLimit() {
  console.log('\n[6] Rate limit — 11th request -> 429');
  const body = { type: 'bullets', content: 'Built APIs. Led team.' };
  let last;
  for (let i = 0; i < 11; i++) {
    last = await post('/api/improve-content', body);
  }
  assert('status 429', last.status === 429, last.status);
  assert('error message present', typeof last.body.error === 'string', last.body);
}

// Runner
(async () => {
  console.log('Security tests — server must be running on localhost:3000');
  try {
    await getCsrf();
    console.log(`  CSRF token: ${csrfToken?.slice(0, 16)}...`);
  } catch (e) {
    console.error('Cannot reach server:', e.message);
    process.exit(1);
  }

  await testUrlSafety();
  await testUnknownType();
  await testMissingContent();
  await testContentTooLong();
  await testMissingFullName();
  await testRateLimit();

  console.log(`\n${'─'.repeat(48)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
