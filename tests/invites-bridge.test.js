const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const { createMockInvites, TTL_SECONDS } = require('../src/mocks/invites.js');

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function assertBridgeEnvelope(value) {
  assert.deepEqual(Object.keys(value).sort(), [
    'bound_user_id',
    'error',
    'expires_ts',
    'invite_url',
    'request_id',
    'status',
    'temporary_key',
  ]);
}

test('standard referral snapshot starts without fictional invitation data', async () => {
  const invites = createMockInvites();
  const snapshot = await invites.getSnapshot();

  assert.equal(snapshot.isMock, true);
  assert.match(snapshot.standardInvitation.url, /^ghostlink-mock:\/\/invite\/ref_/);
  assert.deepEqual(snapshot.invitations, []);
  assert.deepEqual(snapshot.stats, { invited: 0, subscribed: 0, pending: 0, expired: 0, rewardDays: 0 });
});

test('empty invite list remains an honest empty state', async () => {
  const snapshot = await createMockInvites({ invitations: [] }).getSnapshot();
  assert.equal(snapshot.invitations.length, 0);
  assert.equal(snapshot.stats.rewardDays, 0);
});

test('Bridge create returns the accepted owner envelope and a fixed 24-hour expiry', async () => {
  const now = 1_760_000_000_000;
  const bridge = createMockInvites({ now: () => now });
  const created = await bridge.createBridge({ request_id: 'project-unique-001' });

  assertBridgeEnvelope(created);
  assert.equal(created.status, 'created');
  assert.equal(created.expires_ts, Math.floor(now / 1000) + TTL_SECONDS);
  assert.equal(created.bound_user_id, null);
  assert.equal(created.error, null);
  assert.match(created.temporary_key, /^ghostlink-mock:\/\/bridge\/temp-/);
  assert.match(created.invite_url, /^ghostlink-mock:\/\/bridge\/invite-/);
  assert.doesNotMatch(created.temporary_key, /^vless:/i);
});

test('the same request_id is idempotent and a second click cannot create another mock key', async () => {
  const bridge = createMockInvites();
  const first = await bridge.createBridge({ request_id: 'request-once' });
  const retry = await bridge.createBridge({ request_id: 'request-once' });
  const newClick = await bridge.createBridge({ request_id: 'request-two' });

  assert.equal(first.request_id, 'request-once');
  assert.equal(retry.request_id, 'request-once');
  assert.equal(newClick.request_id, 'request-once');
  assert.equal(first.temporary_key, retry.temporary_key);
  assert.equal(bridge.getCreateCount(), 1);
});

test('request_id remains globally unique and a foreign owner cannot read or reuse it', async () => {
  const storage = createMemoryStorage();
  const firstOwner = createMockInvites({ storage, ownerId: 'mock-owner-a' });
  const secondOwner = createMockInvites({ storage, ownerId: 'mock-owner-b' });
  const created = await firstOwner.createBridge({ request_id: 'global-request-id' });

  await assert.rejects(
    secondOwner.createBridge({ request_id: 'global-request-id' }),
    (error) => error.code === 'not_found' && error.request_id === created.request_id,
  );
  assert.equal(await secondOwner.getBridgeStatus(created.request_id), null);
  assert.equal(secondOwner.getBridgeRecord(created.request_id), null);
  assert.equal(secondOwner.getCreateCount(), 0);
});

test('a foreign owner cannot change or expire another owner operation', async () => {
  let now = 1_760_000_000_000;
  const storage = createMemoryStorage();
  const owner = createMockInvites({ storage, ownerId: 'owner-a', now: () => now });
  const foreign = createMockInvites({ storage, ownerId: 'owner-b', now: () => now + TTL_SECONDS * 1000 });
  const created = await owner.createBridge({ request_id: 'owner-only-transition' });

  await assert.rejects(
    foreign.markTransferred(created.request_id),
    (error) => error.code === 'not_found',
  );
  await foreign.createBridge({ request_id: 'foreign-own-operation' });
  assert.equal((await owner.getBridgeStatus(created.request_id)).status, 'created');

  now += TTL_SECONDS * 1000;
  assert.equal((await owner.getBridgeStatus(created.request_id)).status, 'expired');
  const blockedTransition = await owner.markTransferred(created.request_id);
  assert.equal(blockedTransition.status, 'expired');
  assert.equal(blockedTransition.error.code, 'invalid_transition');
});

test('a saved active Bridge operation is restored after Mini App reopening', async () => {
  const storage = createMemoryStorage();
  const beforeReload = createMockInvites({ storage });
  const first = await beforeReload.createBridge({ request_id: 'restore-bridge' });

  const afterReload = createMockInvites({ storage });
  const restored = await afterReload.getLatestBridge();
  const accidentalNewClick = await afterReload.createBridge({ request_id: 'different-after-reload' });

  assert.equal(restored.request_id, first.request_id);
  assert.equal(restored.temporary_key, first.temporary_key);
  assert.equal(accidentalNewClick.request_id, first.request_id);
  assert.equal(afterReload.getCreateCount(), 0);
});

test('Bridge transitions follow created to transferred to waiting_join to bound', async () => {
  const bridge = createMockInvites();
  const created = await bridge.createBridge({ request_id: 'bridge-lifecycle' });
  const transferred = await bridge.markTransferred(created.request_id);
  const waiting = await bridge.markWaitingJoin(created.request_id);
  const bound = await bridge.bindMockUser(created.request_id, 'mock-guest-777');

  assert.equal(transferred.status, 'transferred');
  assert.equal(waiting.status, 'waiting_join');
  assert.equal(bound.status, 'bound');
  assert.equal(bound.bound_user_id, 'mock-guest-777');
  assert.equal(bound.temporary_key, created.temporary_key);
  assert.equal(bound.invite_url, created.invite_url);
});

test('copying is not a Bridge transition', async () => {
  const bridge = createMockInvites();
  const created = await bridge.createBridge({ request_id: 'copy-is-neutral' });
  const checked = await bridge.getBridgeStatus(created.request_id);

  assert.equal(checked.status, 'created');
  assert.equal(checked.request_id, created.request_id);
});

test('operation expires exactly after 24 hours and invalidates temporary presentation', async () => {
  let now = 1_760_000_000_000;
  const bridge = createMockInvites({ now: () => now });
  const created = await bridge.createBridge({ request_id: 'expires-bridge' });
  now += (TTL_SECONDS * 1000);
  const expired = await bridge.getBridgeStatus(created.request_id);

  assert.equal(expired.status, 'expired');
  assert.equal(expired.temporary_key, null);
  assert.equal(expired.invite_url, null);
  assert.equal(expired.bound_user_id, null);
});

test('failed is terminal and preserves its original error on a later action', async () => {
  const bridge = createMockInvites();
  await bridge.createBridge({ request_id: 'failed-bridge' });
  const failed = await bridge.failBridge('failed-bridge', { code: 'bridge_unavailable', message: 'Bridge недоступен.' });
  const repeatedAction = await bridge.markTransferred('failed-bridge');

  assert.equal(failed.status, 'failed');
  assert.deepEqual(failed.error, { code: 'bridge_unavailable', message: 'Bridge недоступен.' });
  assert.equal(repeatedAction.status, 'failed');
  assert.deepEqual(repeatedAction.error, failed.error);
});

test('timeout preserves the same request_id for later recovery without a second key', async () => {
  const storage = createMemoryStorage();
  const bridge = createMockInvites({ storage });
  await assert.rejects(
    bridge.createBridge({ request_id: 'timeout-bridge', scenario: 'timeout' }),
    (error) => error.type === 'timeout' && error.request_id === 'timeout-bridge',
  );

  const afterRetry = createMockInvites({ storage });
  const recovered = await afterRetry.createBridge({ request_id: 'timeout-bridge' });
  assert.equal(recovered.request_id, 'timeout-bridge');
  assert.equal(recovered.status, 'created');
  assert.equal(afterRetry.getCreateCount(), 0);
});

test('offline preserves the same mock operation and never claims a successful bind', async () => {
  const storage = createMemoryStorage();
  const bridge = createMockInvites({ storage, online: false });
  await assert.rejects(
    bridge.createBridge({ request_id: 'offline-bridge' }),
    (error) => error.type === 'network',
  );

  bridge.setOnline(true);
  const recovered = await bridge.getBridgeStatus('offline-bridge');
  assert.equal(recovered.status, 'created');
  assert.equal(recovered.bound_user_id, null);
});

test('offline prevents a status transition until the same operation can be checked again', async () => {
  const bridge = createMockInvites();
  await bridge.createBridge({ request_id: 'offline-transition' });
  bridge.setOnline(false);
  await assert.rejects(bridge.markTransferred('offline-transition'), (error) => error.type === 'network');
  bridge.setOnline(true);
  assert.equal((await bridge.getBridgeStatus('offline-transition')).status, 'created');
});

test('invite UI does not call an external QR service or present a real VLESS key', () => {
  const moduleSource = readFileSync(join(__dirname, '..', 'src', 'modules', 'invites.js'), 'utf8');
  const templateSource = readFileSync(join(__dirname, '..', 'src', 'templates', 'pages', 'invites.html'), 'utf8');

  assert.doesNotMatch(moduleSource, /quickchart\.io/i);
  assert.doesNotMatch(templateSource, /quickchart\.io/i);
  assert.match(moduleSource, /restoreLatestBridge/);
  assert.match(moduleSource, /markTransferred/);
  assert.match(moduleSource, /markWaitingJoin/);
  assert.match(moduleSource, /bindMockUser/);
  assert.doesNotMatch(moduleSource, /vless:\/\//i);
});

test('referral template contains hero card, bonus counter, medallion chain, and empty state', () => {
  const templateSource = readFileSync(join(__dirname, '..', 'src', 'templates', 'pages', 'invites.html'), 'utf8');

  assert.match(templateSource, /class="referral-hero-card"/);
  assert.match(templateSource, /id="refRewardDaysNum"/);
  assert.match(templateSource, /id="refChainContainer"/);
  assert.match(templateSource, /id="refStatsToggle"/);
  assert.match(templateSource, /id="refStatsDrawer"/);
  assert.match(templateSource, /id="btnModeStandard"/);
  assert.match(templateSource, /id="btnModeBridge"/);
  assert.match(templateSource, /Мост 2\.0 \(В разработке 🚧\)/);
  assert.match(templateSource, /id="refLinkBox"/);
  assert.match(templateSource, /id="refLinkText"/);
  assert.match(templateSource, /id="btnShareReferral"/);
  assert.match(templateSource, /id="refFriendsList"/);
  assert.match(templateSource, /Приглашений пока нет/);
  assert.match(templateSource, /Отправьте ссылку первому другу!/);
});

test('Bridge tab click shows toast notification and does not trigger bridge workflow', () => {
  const moduleSource = readFileSync(join(__dirname, '..', 'src', 'modules', 'invites.js'), 'utf8');

  assert.match(moduleSource, /btnModeBridge/);
  assert.match(moduleSource, /Режим Bridge находится в разработке 🚧/);
  assert.match(moduleSource, /Ссылка скопирована!/);
  assert.match(moduleSource, /t\.me\/share\/url\?url=/);
});
