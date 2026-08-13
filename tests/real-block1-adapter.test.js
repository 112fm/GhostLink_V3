const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { createRealBlock1Adapter } = require(path.join(root, 'src', 'api', 'real-block1-adapter.js'));

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body === undefined ? '' : JSON.stringify(body),
  };
}

test('real Block 1 opens an ephemeral session then reads profile and tariffs', async () => {
  const calls = [];
  const adapter = createRealBlock1Adapter({
    apiBase: 'https://api.example.test',
    getInitData: () => 'telegram-init-data',
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/api/miniapp/session')) return response(200, { ok: true, session_token: 'secret-token' });
      if (url.endsWith('/api/user')) {
        return response(200, {
          user: { id: '1', name: 'Test User' },
          subscription: { active: true, status: 'active', expiry: '2026-08-17', days_left: 10 },
          device_limit: 3,
          connected_devices: 1,
          tariff_name: 'Flex Squad',
        });
      }
      if (url.endsWith('/api/tariffs')) return response(200, { period_prices: { 1: { 3: { price: 150 } } } });
      throw new Error(`Unexpected URL: ${url}`);
    },
    now: () => new Date('2026-08-07T12:00:00Z'),
  });

  const snapshot = await adapter.fetchProfileSubscription();

  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, 'https://api.example.test/api/miniapp/session');
  assert.equal(calls[0].options.method, 'POST');
  assert.match(String(calls[0].options.body), /init_data=telegram-init-data/);
  assert.equal(calls[1].options.method, 'GET');
  assert.equal(calls[2].options.method, 'GET');
  assert.equal(calls[1].options.headers['X-PWA-Token'], 'secret-token');
  assert.equal(calls[2].options.headers['X-PWA-Token'], 'secret-token');
  assert.equal(snapshot.profile.displayName, 'Test User');
  assert.equal(snapshot.subscription.remainingDays, 10);
  assert.equal(snapshot.subscription.deviceLimit, 3);
  assert.equal(snapshot.subscription.usedDevices, 1);
  assert.equal(snapshot.subscription.totalDays, null);
  assert.equal(adapter.getSession().token, undefined);
  assert.deepEqual(adapter.getDiagnostics().initData_present, true);
  assert.equal(adapter.getDiagnostics().session_status, 200);
  assert.equal(adapter.getDiagnostics().user_status, 200);
  assert.equal(adapter.getDiagnostics().tariffs_status, 200);
});

test('real Block 1 waits briefly for delayed Telegram initData before opening a session', async () => {
  let initDataReads = 0;
  const adapter = createRealBlock1Adapter({
    apiBase: 'https://api.example.test',
    getInitData: () => (++initDataReads < 3 ? '' : 'delayed-init-data'),
    sleep: async () => {},
    fetch: async (url) => {
      if (url.endsWith('/api/miniapp/session')) return response(200, { session_token: 'secret-token' });
      if (url.endsWith('/api/user')) return response(200, {
        user: { id: '1', name: 'Delayed User' },
        subscription: { active: true, status: 'active', days_left: 5 },
        device_limit: 2,
        connected_devices: 1,
        tariff_name: 'Solo Ghost',
      });
      return response(200, { period_prices: {} });
    },
  });

  const snapshot = await adapter.fetchProfileSubscription();

  assert.equal(snapshot.profile.displayName, 'Delayed User');
  assert.equal(initDataReads, 3);
  assert.equal(adapter.getDiagnostics().initData_present, true);
});

test('real Block 1 reports a missing Telegram initData without making a session request', async () => {
  let nowMs = 0;
  let fetchCalls = 0;
  const adapter = createRealBlock1Adapter({
    getInitData: () => '',
    initDataWaitMs: 300,
    totalTimeoutMs: 1000,
    nowMs: () => nowMs,
    sleep: async (duration) => { nowMs += duration; },
    fetch: async () => {
      fetchCalls += 1;
      return response(200, {});
    },
  });

  await assert.rejects(adapter.fetchProfileSubscription(), (error) => error.type === 'auth' && error.status === 401);

  assert.equal(fetchCalls, 0);
  assert.equal(adapter.getDiagnostics().initData_present, false);
  assert.equal(adapter.getDiagnostics().session_status, 'not_started');
});

test('real Block 1 keeps 401 and 403 distinct from a new profile', async () => {
  for (const status of [401, 403]) {
    const adapter = createRealBlock1Adapter({
      apiBase: 'https://api.example.test',
      getInitData: () => 'telegram-init-data',
      fetch: async () => response(status, { detail: status === 401 ? 'unauthorized' : 'access_closed' }),
    });

    await assert.rejects(adapter.fetchProfileSubscription(), (error) => {
      assert.equal(error.status, status);
      assert.equal(error.type, 'auth');
      return true;
    });
  }
});

test('real Block 1 rejects empty and malformed JSON without silently using mock data', async () => {
  for (const text of ['', '{bad json']) {
    const adapter = createRealBlock1Adapter({
      apiBase: 'https://api.example.test',
      getInitData: () => 'telegram-init-data',
      fetch: async () => ({ ok: true, status: 200, text: async () => text }),
    });

    await assert.rejects(adapter.fetchProfileSubscription(), (error) => error.type === 'invalid_json');
  }
});

test('real Block 1 never persists initData or session tokens', () => {
  const source = require('node:fs').readFileSync(path.join(root, 'src', 'api', 'real-block1-adapter.js'), 'utf8');

  assert.doesNotMatch(source, /localStorage|sessionStorage|setItem\s*\(/);
  assert.doesNotMatch(source, /console\.(log|info|debug)/);
});

test('V3 runtime loads the real Block 1 adapter instead of the local profile mock', () => {
  const fs = require('node:fs');
  const template = fs.readFileSync(path.join(root, 'src', 'templates', 'index.template.html'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

  assert.match(template, /src\/api\/real-block1-adapter\.js/);
  assert.doesNotMatch(template, /src\/api\/local-block1-adapter\.js/);
  assert.match(main, /createRealBlock1Adapter/);
  assert.doesNotMatch(main, /createLocalBlock1Adapter/);
});
