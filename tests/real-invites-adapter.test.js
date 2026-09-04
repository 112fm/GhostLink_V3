const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const { createRealInvitesAdapter, normalizeInvitation } = require(join(root, 'src', 'api', 'real-invites-adapter.js'));

test('production build graph and main.js completely exclude mock invites', () => {
  const mainSource = readFileSync(join(root, 'src', 'main.js'), 'utf8');
  const templateSource = readFileSync(join(root, 'src', 'templates', 'index.template.html'), 'utf8');
  const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');

  // Verify main.js uses real adapter and has zero references to createMockInvites
  assert.doesNotMatch(mainSource, /createMockInvites/);
  assert.match(mainSource, /createRealInvitesAdapter/);

  // Verify script tags in template and index.html do NOT include mocks/invites.js
  assert.doesNotMatch(templateSource, /src\/mocks\/invites\.js/);
  assert.match(templateSource, /src\/api\/real-invites-adapter\.js/);
  assert.doesNotMatch(indexHtml, /src\/mocks\/invites\.js/);
  assert.match(indexHtml, /src\/api\/real-invites-adapter\.js/);
});

test('createRealInvitesAdapter reads referral_link from profileSubscription', async () => {
  const fakeProfile = {
    referral_link: 'https://t.me/GhostLink_VPN_bot?start=ref_custom123',
    user: { id: 'user-77', referral_link: 'https://t.me/GhostLink_VPN_bot?start=ref_custom123' },
  };

  const adapter = createRealInvitesAdapter({
    profileSubscription: {
      getSnapshot: () => fakeProfile,
    },
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [], total: 0, active: 0, used: 0 }),
    }),
  });

  const snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.isMock, false);
  assert.equal(snapshot.standardInvitation.url, 'https://t.me/GhostLink_VPN_bot?start=ref_custom123');
  assert.equal(snapshot.stats.rewardDays, 0);
  assert.deepEqual(snapshot.invitations, []);
});

test('createRealInvitesAdapter sends X-PWA-Token header to /api/invite/list', async () => {
  let requestedUrl = '';
  let requestedHeaders = {};

  const adapter = createRealInvitesAdapter({
    apiBase: 'https://api.test',
    getToken: () => 'test-pwa-token-xyz',
    fetch: async (url, options) => {
      requestedUrl = url;
      requestedHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ items: [], total: 0 }),
      };
    },
  });

  await adapter.getSnapshot();
  assert.equal(requestedUrl, 'https://api.test/api/invite/list');
  assert.equal(requestedHeaders['X-PWA-Token'], 'test-pwa-token-xyz');
  assert.equal(requestedHeaders['Accept'], 'application/json');
});

test('createRealInvitesAdapter maps /api/invite/list items and calculates reward days (subscribed * 14)', async () => {
  const mockApiList = {
    items: [
      { id: '1', token: 'token-used-1', status: 'used', name: 'Иван', created_ts: 1788000000 },
      { id: '2', token: 'token-paid-2', status: 'paid', name: 'Ольга', created_ts: 1788100000 },
      { id: '3', token: 'token-act-3', status: 'active', name: '', invited_tg_id: '998877', created_ts: 1788200000 },
      { id: '4', token: 'token-exp-4', status: 'expired', name: '', created_ts: 1788300000 },
    ],
    total: 4,
    used: 2,
    active: 1,
    expired: 1,
  };

  const adapter = createRealInvitesAdapter({
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockApiList),
    }),
  });

  const snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.isMock, false);
  assert.equal(snapshot.stats.invited, 4);
  assert.equal(snapshot.stats.subscribed, 2);
  assert.equal(snapshot.stats.pending, 1);
  assert.equal(snapshot.stats.expired, 1);
  assert.equal(snapshot.stats.rewardDays, 28); // 2 * 14 = 28

  assert.equal(snapshot.invitations.length, 4);
  assert.equal(snapshot.invitations[0].name, 'Иван');
  assert.equal(snapshot.invitations[0].status, 'subscribed');
  assert.equal(snapshot.invitations[1].name, 'Ольга');
  assert.equal(snapshot.invitations[1].status, 'subscribed');
  assert.equal(snapshot.invitations[2].name, 'ID 998877');
  assert.equal(snapshot.invitations[2].status, 'pending');
  assert.equal(snapshot.invitations[3].name, 'Инвайт token-');
  assert.equal(snapshot.invitations[3].status, 'expired');
});

test('createRealInvitesAdapter gracefully falls back to profile link on network failure without throwing and sets isUnavailable: true', async () => {
  const fakeProfile = {
    referral_link: 'https://t.me/GhostLink_VPN_bot?start=ref_safe_fallback',
  };

  const adapter = createRealInvitesAdapter({
    profileSubscription: {
      getSnapshot: () => fakeProfile,
    },
    fetch: async () => {
      throw new Error('Network error: server unreachable');
    },
  });

  // Must not throw:
  const snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.isMock, false);
  assert.equal(snapshot.isUnavailable, true);
  assert.equal(snapshot.standardInvitation.url, 'https://t.me/GhostLink_VPN_bot?start=ref_safe_fallback');
  assert.equal(snapshot.stats.rewardDays, 0);
  assert.equal(snapshot.stats.invited, 0);
  assert.equal(snapshot.stats.subscribed, 0);
  assert.deepEqual(snapshot.invitations, []);
});

test('createRealInvitesAdapter processes production FastAPI /api/invite/list schema (items, total, active, used, expired) and calculates rewardDays = used * 14', async () => {
  const fastApiResponse = {
    items: [
      {
        token: 'alpha123',
        type: 'bridge',
        status: 'used',
        inviter_tg_id: '12345678',
        invited_tg_id: '87654321',
        created_ts: 1725400000,
        expires_ts: 1725486400,
        expires_in_sec: 0,
        max_activations: 1,
        activations_used: 1,
        direct_link: 'https://t.me/GhostLink_VPN_bot?start=alpha123',
        bridge_link: 'https://api.112prd.ru/join/alpha123',
        telegram_start_link: 'https://t.me/GhostLink_VPN_bot?start=alpha123',
      },
      {
        token: 'beta456',
        type: 'bridge',
        status: 'used',
        inviter_tg_id: '12345678',
        invited_tg_id: '11223344',
        created_ts: 1725410000,
        expires_ts: 1725496400,
        expires_in_sec: 0,
        max_activations: 1,
        activations_used: 1,
        direct_link: 'https://t.me/GhostLink_VPN_bot?start=beta456',
        bridge_link: 'https://api.112prd.ru/join/beta456',
        telegram_start_link: 'https://t.me/GhostLink_VPN_bot?start=beta456',
      },
      {
        token: 'gamma789',
        type: 'bridge',
        status: 'active',
        inviter_tg_id: '12345678',
        invited_tg_id: '',
        created_ts: 1725420000,
        expires_ts: 1725506400,
        expires_in_sec: 86400,
        max_activations: 1,
        activations_used: 0,
        direct_link: 'https://t.me/GhostLink_VPN_bot?start=gamma789',
        bridge_link: 'https://api.112prd.ru/join/gamma789',
        telegram_start_link: 'https://t.me/GhostLink_VPN_bot?start=gamma789',
      },
      {
        token: 'delta000',
        type: 'bridge',
        status: 'expired',
        inviter_tg_id: '12345678',
        invited_tg_id: '',
        created_ts: 1725000000,
        expires_ts: 1725086400,
        expires_in_sec: 0,
        max_activations: 1,
        activations_used: 0,
        direct_link: 'https://t.me/GhostLink_VPN_bot?start=delta000',
        bridge_link: 'https://api.112prd.ru/join/delta000',
        telegram_start_link: 'https://t.me/GhostLink_VPN_bot?start=delta000',
      },
    ],
    total: 4,
    active: 1,
    used: 2,
    revoked: 0,
    expired: 1,
  };

  const adapter = createRealInvitesAdapter({
    profileSubscription: {
      getSnapshot: () => ({ referral_link: 'https://t.me/GhostLink_VPN_bot?start=ref_prod_user' }),
    },
    fetch: async (url) => {
      assert.match(url, /\/api\/invite\/list$/);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(fastApiResponse),
      };
    },
  });

  const snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.isMock, false);
  assert.equal(snapshot.isUnavailable, false);
  assert.equal(snapshot.standardInvitation.url, 'https://t.me/GhostLink_VPN_bot?start=ref_prod_user');
  assert.equal(snapshot.stats.invited, 4);
  assert.equal(snapshot.stats.subscribed, 2);
  assert.equal(snapshot.stats.pending, 1);
  assert.equal(snapshot.stats.expired, 1);
  assert.equal(snapshot.stats.rewardDays, 28); // used (2) * 14 = 28
  assert.equal(snapshot.invitations.length, 4);
  assert.equal(snapshot.invitations[0].status, 'subscribed');
  assert.equal(snapshot.invitations[1].status, 'subscribed');
  assert.equal(snapshot.invitations[2].status, 'pending');
  assert.equal(snapshot.invitations[3].status, 'expired');
});

test('invites UI renders informative network error state card when snapshot.isUnavailable is true', () => {
  const invitesJs = readFileSync(join(root, 'src', 'modules', 'invites.js'), 'utf8');
  assert.match(invitesJs, /snapshot\.isUnavailable/);
  assert.match(invitesJs, /Не удалось обновить список друзей/);
  assert.match(invitesJs, /Проверьте подключение к сети/);
});

test('page-other-device.css has no obsolete .other-device-picker-status or .other-device-picker-list selectors', () => {
  const css = readFileSync(join(root, 'src', 'css', 'page-other-device.css'), 'utf8');
  assert.doesNotMatch(css, /\.other-device-picker-status/);
  assert.doesNotMatch(css, /\.other-device-picker-list/);
});

test('normalizeInvitation cleanly formats arbitrary objects or missing fields', () => {
  assert.equal(normalizeInvitation(null), null);
  assert.equal(normalizeInvitation(undefined), null);

  const fallback = normalizeInvitation({});
  assert.ok(fallback.id);
  assert.equal(fallback.status, 'pending');
  assert.equal(fallback.name, 'Приглашение 1');
  assert.equal(fallback.createdAt, 'Недавно');
});
