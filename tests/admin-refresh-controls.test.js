const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const adminSource = fs.readFileSync(path.join(root, 'src/modules/admin.js'), 'utf8');

test('admin has one shared refresh control and no tab-local duplicates', () => {
  assert.match(html, /id=["']btnAdminRefresh["']/);
  assert.doesNotMatch(html, /id=["']btnRefreshFinance["']/);
  assert.doesNotMatch(html, /id=["']btnRefreshSystem["']/);
  assert.doesNotMatch(html, /id=["']btnRefreshFinText["']/);
  assert.doesNotMatch(html, /id=["']sysRefreshIcon["']/);
  assert.doesNotMatch(html, /id=["']sysRefreshLabel["']/);
});

test('shared refresh still routes finance and system tabs', () => {
  assert.match(adminSource, /activeTab === 'finance'[\s\S]*?await renderFinanceTab\(\)/);
  assert.match(adminSource, /activeTab === 'system'[\s\S]*?await refreshSystemTab\(\)/);
});

test('system refresh no longer depends on removed local controls', () => {
  assert.doesNotMatch(adminSource, /getElementById\('btnRefreshSystem'\)/);
  assert.doesNotMatch(adminSource, /getElementById\('sysRefreshIcon'\)/);
  assert.doesNotMatch(adminSource, /getElementById\('sysRefreshLabel'\)/);
});
