const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const security = require(path.join(root, 'src', 'mocks', 'admin-security.js'));

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('default-deny mock session rejects adapter calls from an ordinary user', () => {
  const session = security.createAdminMockSession();
  const adapter = security.protectAdminAdapter({ save: async () => 'saved' }, session);

  assert.equal(session.isAdmin(), false);
  assert.throws(() => adapter.save(), (error) => error.code === 'admin_role_required');
});

test('admin mock session is separate from UI state and allows the local adapter', async () => {
  const session = security.createAdminMockSession({ role: 'admin' });
  const adapter = security.protectAdminAdapter({ save: async () => 'saved' }, session);

  assert.equal(session.isAdmin(), true);
  assert.equal(await adapter.save(), 'saved');
});

test('same request id restores one restart or backup operation after recreation', () => {
  const storage = createMemoryStorage();
  const firstStore = security.createAdminMockOperationStore({ storage });
  const first = firstStore.start({ requestId: 'restart-once', actionType: 'restart_xray', serverId: 'srv-fi-01' });
  const duplicate = firstStore.start({ requestId: 'restart-once', actionType: 'restart_xray', serverId: 'srv-fi-01' });
  const afterReload = security.createAdminMockOperationStore({ storage });

  assert.equal(first.jobId, duplicate.jobId);
  assert.deepEqual(afterReload.get('restart-once'), first);
  assert.equal(afterReload.complete('restart-once').status, 'succeeded');
  assert.equal(afterReload.complete('restart-once').jobId, first.jobId);
});

test('admin user persistence contains no key, token or raw URI fields', () => {
  const users = fs.readFileSync(path.join(root, 'src', 'modules', 'admin', 'users.js'), 'utf8');
  assert.match(users, /delete safeDevice\.key/);
  assert.match(users, /delete safeDevice\.token/);
  assert.match(users, /delete safeDevice\.setupToken/);
  assert.match(users, /mockRef/);
});
