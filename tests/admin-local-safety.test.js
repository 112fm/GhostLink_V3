const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const adminDirectory = path.join(root, 'src', 'modules', 'admin');
const sources = [
  path.join(root, 'src', 'modules', 'admin-payment-settings.js'),
  ...fs.readdirSync(adminDirectory)
    .filter((file) => file.endsWith('.js'))
    .map((file) => path.join(adminDirectory, file)),
  path.join(root, 'src', 'templates', 'pages', 'admin.html'),
];

function sourceText() {
  return sources.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
}

function executableSource() {
  return sourceText()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('admin mock is local-only and wires its entry to open dashboard overlay', () => {
  const source = fs.readFileSync(path.join(adminDirectory, 'dashboard.js'), 'utf8');
  assert.match(source, /adminMockSession/);
  assert.match(source, /requireAdminMockAccess/);
  assert.match(source, /openOverlay\(pageAdmin\)/);
  assert.match(source, /closeOverlay\(pageAdmin\)/);
  assert.doesNotMatch(source, /pageAdminDashboard\?\.remove\(\)/);
});

test('admin mock contains no executable network, Telegram or storage-runtime calls', () => {
  const source = executableSource();
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bXMLHttpRequest\b|\bWebSocket\b|\bsqlite\b/i);
  assert.doesNotMatch(source, /window\.open\s*\(|openTelegramLink\s*\(/);
});

test('admin sample device references are opaque and never look like VPN keys', () => {
  const source = sourceText();
  assert.match(source, /mock-device-record-/);
  assert.doesNotMatch(source, /mock-key:\/\//);
  assert.doesNotMatch(source, /\bvless:\/\//);
});

test('dangerous mock actions retain explicit confirmation gates', () => {
  const users = fs.readFileSync(path.join(adminDirectory, 'users.js'), 'utf8');
  const partners = fs.readFileSync(path.join(adminDirectory, 'partners.js'), 'utf8');
  const system = fs.readFileSync(path.join(adminDirectory, 'system.js'), 'utf8');

  assert.match(users, /window\.confirm\(`Удалить устройство/);
  assert.match(users, /btnModalBlock_confirm/);
  assert.match(users, /deleteConfirmInput\.value\.trim\(\)\.toUpperCase\(\) === 'УДАЛИТЬ'/);
  assert.match(partners, /modalConfirmSuspendPartner/);
  assert.match(system, /openConfirmActionModal/);
  assert.match(system, /modalSystemConfirmAction/);
  assert.match(system, /confirmationState !== 'armed'/);
  assert.match(system, /confirmationState = 'consumed'/);
  assert.match(system, /requireAdminMockAccess\('restart_xray'\)/);
  assert.match(system, /requireAdminMockAccess\('create_backup'\)/);
  assert.match(users, /requireAdminMockAccess\('mutate_user'\)/);
  assert.match(partners, /requireAdminMockAccess\('create_partner'\)/);
});
