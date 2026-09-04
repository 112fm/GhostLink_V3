const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

test('preview identifies its profile as a demonstration instead of a test user', () => {
  const adapter = read('src', 'api', 'local-block1-adapter.js');
  const profiles = read('src', 'mocks', 'subscription.js');

  assert.doesNotMatch(adapter, /Тестовый пользователь/);
  assert.doesNotMatch(profiles, /Тестовый пользователь/);
  assert.match(adapter, /Демонстрационный режим/);
});

test('public mock invitations never contain a real GhostLinkBot URL', () => {
  const invites = read('src', 'mocks', 'invites.js');
  const template = read('src', 'templates', 'pages', 'invites.html');
  const devices = read('src', 'modules', 'devices.js');

  [invites, template, devices].forEach((source) => {
    assert.doesNotMatch(source, /(?:https?:\/\/|tg:\/\/)[^'"`\s]*GhostLinkBot/i);
  });
  assert.match(invites, /ghostlink-mock:\/\/invite\/ref_/);
  assert.match(invites, /ghostlink-mock:\/\/bridge\/invite-/);
});



test('device cards keep actions on a dedicated full-width row', () => {
  const devices = read('src', 'modules', 'devices.js');
  const css = read('src', 'css', 'page-settings.css');

  assert.match(devices, /card\.append\(left, right, actions\)/);
  assert.match(css, /\.device-card-actions\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /\.device-apple-name\s*\{[\s\S]*white-space:\s*normal/);
  assert.match(css, /@media\s*\(max-width:\s*380px\)/);
});

test('the single help trigger is fixed to the current app header', () => {
  const template = read('src', 'templates', 'index.template.html');
  const css = read('src', 'css', 'context-help.css');

  assert.equal((template.match(/id="helpButton"/g) || []).length, 1);
  assert.match(css, /\.context-help-trigger\s*\{[\s\S]*position:\s*(?:fixed|absolute)/);
  assert.match(css, /\.context-help-trigger\s*\{[\s\S]*right:/);
  assert.doesNotMatch(css, /\.context-help-trigger\s*\{[\s\S]*left:\s*calc/);
});
