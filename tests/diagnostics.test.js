const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { isDiagnosticsEnabled } = require(path.join(root, 'src', 'modules', 'diagnostics.js'));

test('diagnostics are opt-in through the exact service query parameter', () => {
  assert.equal(isDiagnosticsEnabled({ search: '?diagnostics=1' }), true);
  assert.equal(isDiagnosticsEnabled({ search: '?diagnostics=0' }), false);
  assert.equal(isDiagnosticsEnabled({ search: '' }), false);
});

test('diagnostics screen has no credentials, profile data, or network requests', () => {
  const template = fs.readFileSync(path.join(root, 'src', 'templates', 'pages', 'diagnostics.html'), 'utf8');
  const source = fs.readFileSync(path.join(root, 'src', 'modules', 'diagnostics.js'), 'utf8');

  assert.match(template, /Telegram initData/);
  assert.doesNotMatch(template, /session_token|X-PWA-Token|displayName|tariff_name/i);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /session_token|X-PWA-Token|init_data/);
  assert.match(source, /Не получен/);
});

test('runtime graph includes the diagnostics template and module', () => {
  const template = fs.readFileSync(path.join(root, 'src', 'templates', 'index.template.html'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

  assert.match(template, /pages\/diagnostics\.html/);
  assert.match(template, /modules\/diagnostics\.js\?v=2/);
  assert.match(main, /initDiagnosticsModule/);
});
