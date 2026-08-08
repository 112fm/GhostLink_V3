const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const adapterModule = require(path.join(root, 'src', 'api', 'local-block1-adapter.js'));

test('local Block 1 opens an in-memory cookie session and returns profile, subscription, and tariffs', async () => {
  const adapter = adapterModule.createLocalBlock1Adapter({ mode: 'active' });
  const snapshot = await adapter.fetchProfileSubscription({ initData: 'do-not-store-this' });

  assert.equal(snapshot.session.status, 'authenticated');
  assert.equal(snapshot.session.transport, 'cookie');
  assert.equal(snapshot.profile.displayName, 'Демонстрационный режим');
  assert.equal(snapshot.subscription.state, 'active');
  assert.equal(snapshot.tariffs.length > 0, true);
  assert.equal(adapter.getSession().initData, undefined);
});

for (const mode of ['trial', 'active', 'approved', 'vip']) {
  test(`local Block 1 returns the normal profile state for ${mode}`, async () => {
    const snapshot = await adapterModule.createLocalBlock1Adapter({ mode }).fetchProfileSubscription();

    assert.equal(snapshot.subscription.state, mode);
    assert.equal(snapshot.subscription.active, true);
    assert.equal(snapshot.profile.access, 'granted');
  });
}

for (const mode of ['none', 'denied']) {
  test(`local Block 1 closes access for ${mode} without claiming a new user`, async () => {
    const snapshot = await adapterModule.createLocalBlock1Adapter({ mode }).fetchProfileSubscription();

    assert.equal(snapshot.profile.access, 'closed');
    assert.equal(snapshot.subscription.state, mode);
    assert.notEqual(snapshot.subscription.state, 'new');
  });
}

test('local Block 1 preserves pending confirmation as a distinct subscription state', async () => {
  const snapshot = await adapterModule.createLocalBlock1Adapter({ mode: 'pending' }).fetchProfileSubscription();

  assert.equal(snapshot.subscription.state, 'pending');
  assert.equal(snapshot.subscription.active, false);
  assert.equal(snapshot.profile.access, 'pending');
});

for (const [mode, type, status] of [
  ['offline', 'network', undefined],
  ['timeout', 'timeout', undefined],
  ['invalid-json', 'invalid_json', undefined],
  ['unauthorized', 'auth', 401],
  ['forbidden', 'auth', 403],
]) {
  test(`local Block 1 exposes ${mode} as a typed local error`, async () => {
    const adapter = adapterModule.createLocalBlock1Adapter({ mode });

    await assert.rejects(adapter.fetchProfileSubscription(), (error) => {
      assert.equal(error.type, type);
      assert.equal(error.status, status);
      return true;
    });
  });
}

test('local Block 1 adapter contains no production transport or persistent Telegram credentials', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'api', 'local-block1-adapter.js'), 'utf8');

  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(source, /setItem\s*\(/);
});
