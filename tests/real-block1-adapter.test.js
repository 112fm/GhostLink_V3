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

test('real Block 1 renders the profile while tariffs continue loading in the background', async () => {
  let releaseTariffs = () => {};
  const adapter = createRealBlock1Adapter({
    apiBase: 'https://api.example.test',
    getInitData: () => 'telegram-init-data',
    fetch: async (url) => {
      if (url.endsWith('/api/miniapp/session')) return response(200, { session_token: 'secret-token' });
      if (url.endsWith('/api/user')) return response(200, {
        user: { id: '1', name: 'Fast Profile' },
        subscription: { active: true, status: 'active', days_left: 12 },
        device_limit: 3,
        connected_devices: 1,
        tariff_name: 'Flex Squad',
      });
      if (url.endsWith('/api/tariffs')) {
        return new Promise((resolve) => {
          releaseTariffs = () => resolve(response(200, { period_prices: {} }));
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  let earlyResult;
  try {
    earlyResult = await Promise.race([
      adapter.fetchProfileSubscription().then((snapshot) => ({ type: 'profile', snapshot })),
      new Promise((resolve) => setTimeout(() => resolve({ type: 'blocked' }), 50)),
    ]);
  } finally {
    releaseTariffs();
  }

  assert.equal(earlyResult.type, 'profile');
  assert.equal(earlyResult.snapshot.profile.displayName, 'Fast Profile');
  assert.equal(earlyResult.snapshot.subscription.remainingDays, 12);
  assert.equal(adapter.getDiagnostics().tariffs_status, 'not_started');
});

test('real Block 1 maps a timeless VIP without inventing a date or a Ghost emoji', async () => {
  const adapter = createRealBlock1Adapter({
    apiBase: 'https://api.example.test',
    getInitData: () => 'telegram-init-data',
    fetch: async (url) => {
      if (url.endsWith('/api/miniapp/session')) return response(200, { session_token: 'secret-token' });
      if (url.endsWith('/api/user')) return response(200, {
        user: { id: '1', name: 'VIP User' },
        subscription: { active: true, status: 'vip', expiry: null, days_left: null },
        device_limit: 3,
        connected_devices: 5,
        tariff_name: 'VIP',
        member_tier: 'vip',
      });
      return response(200, { period_prices: {} });
    },
  });

  const snapshot = await adapter.fetchProfileSubscription();

  assert.equal(snapshot.subscription.state, 'vip');
  assert.equal(snapshot.subscription.active, true);
  assert.equal(snapshot.subscription.isTimeless, true);
  assert.equal(snapshot.subscription.plan.title, 'VIP');
  assert.equal(snapshot.subscription.plan.emoji, '💎');
  assert.equal(snapshot.subscription.remainingDays, null);
  assert.equal(snapshot.subscription.usedDevices, 5);
  assert.equal(snapshot.subscription.deviceLimit, 3);
});

test('real Block 1 keeps a member-tier VIP active when a nested subscription is stale', async () => {
  const adapter = createRealBlock1Adapter({
    apiBase: 'https://api.example.test',
    getInitData: () => 'telegram-init-data',
    fetch: async (url) => {
      if (url.endsWith('/api/miniapp/session')) return response(200, { session_token: 'secret-token' });
      if (url.endsWith('/api/user')) return response(200, {
        user: { id: '1', name: 'VIP User' },
        subscription: { active: false, status: 'active', expiry: null, days_left: null },
        status: 'vip',
        member_tier: 'vip',
        device_limit: 3,
        connected_devices: 5,
        tariff_name: 'VIP',
      });
      return response(200, { period_prices: {} });
    },
  });

  const snapshot = await adapter.fetchProfileSubscription();

  assert.equal(snapshot.subscription.state, 'vip');
  assert.equal(snapshot.subscription.active, true);
  assert.equal(snapshot.subscription.isTimeless, true);
  assert.equal(snapshot.subscription.expiry, null);
  assert.equal(snapshot.subscription.remainingDays, null);
  assert.equal(snapshot.subscription.plan.title, 'VIP');
  assert.equal(snapshot.subscription.plan.emoji, '💎');
});

test('real Block 1 maps expired dated VIP to expired state with active false', async () => {
  const adapter = createRealBlock1Adapter({
    apiBase: 'https://api.example.test',
    getInitData: () => 'telegram-init-data',
    fetch: async (url) => {
      if (url.endsWith('/api/miniapp/session')) return response(200, { session_token: 'secret-token' });
      if (url.endsWith('/api/user')) return response(200, {
        user: { id: '1', name: 'Expired VIP' },
        subscription: { active: false, status: 'vip', expiry: '2026-08-20', days_left: 0 },
        tariff_name: 'VIP',
        member_tier: 'vip',
        device_limit: 3,
        connected_devices: 2,
      });
      return response(200, { period_prices: {} });
    },
  });

  const snapshot = await adapter.fetchProfileSubscription();

  assert.equal(snapshot.subscription.state, 'expired');
  assert.equal(snapshot.subscription.active, false);
  assert.equal(snapshot.subscription.isTimeless, false);
  assert.equal(snapshot.subscription.expiry, '2026-08-20');
  assert.equal(snapshot.subscription.remainingDays, 0);
  assert.equal(snapshot.subscription.plan.title, 'VIP');
  assert.equal(snapshot.subscription.plan.emoji, '💎');
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

test('real Block 1 normalizes trial tariffs to ПРОБНЫЙ ПЕРИОД with gift emoji', async () => {
  for (const rawName of ['trial_7d', 'trial', 'TRIAL_7D', 'пробный']) {
    const adapter = createRealBlock1Adapter({
      apiBase: 'https://api.example.test',
      getInitData: () => 'telegram-init-data',
      fetch: async (url) => {
        if (url.endsWith('/api/miniapp/session')) return response(200, { session_token: 'secret-token' });
        if (url.endsWith('/api/user')) return response(200, {
          user: { id: '1', name: 'Trial User' },
          subscription: { active: true, status: 'active', days_left: 7 },
          device_limit: 2,
          connected_devices: 1,
          tariff_name: rawName,
        });
        return response(200, { period_prices: {} });
      },
    });

    const snapshot = await adapter.fetchProfileSubscription();
    assert.equal(snapshot.subscription.plan.title, 'ПРОБНЫЙ ПЕРИОД');
    assert.equal(snapshot.subscription.plan.emoji, '🎁');
    assert.equal(snapshot.subscription.remainingDays, 7);
  }
});

test('real Block 1 maps trial status to ПРОБНЫЙ ПЕРИОД even when tariff_name is empty', async () => {
  const adapter = createRealBlock1Adapter({
    apiBase: 'https://api.example.test',
    getInitData: () => 'telegram-init-data',
    fetch: async (url) => {
      if (url.endsWith('/api/miniapp/session')) return response(200, { session_token: 'secret-token' });
      if (url.endsWith('/api/user')) return response(200, {
        user: { id: '1', name: 'Trial User' },
        subscription: { active: true, status: 'trial', days_left: 7 },
        status: 'trial',
        device_limit: 2,
        connected_devices: 1,
        tariff_name: null,
      });
      return response(200, { period_prices: {} });
    },
  });

  const snapshot = await adapter.fetchProfileSubscription();
  assert.equal(snapshot.subscription.plan.title, 'ПРОБНЫЙ ПЕРИОД');
  assert.equal(snapshot.subscription.plan.emoji, '🎁');
  assert.equal(snapshot.subscription.plan.id, 'trial');
});

test('real Block 1 fast-fails with 401 when running outside Telegram without waiting 3 seconds', async () => {
  const adapter = createRealBlock1Adapter({
    apiBase: 'https://api.example.test',
  });

  await assert.rejects(adapter.fetchProfileSubscription(), (error) => {
    assert.equal(error.type, 'auth');
    assert.equal(error.status, 401);
    return true;
  });
});

test('real Block 1 defaults active subscription without tariff_name to SOLO with ghost emoji', async () => {
  const adapter = createRealBlock1Adapter({
    apiBase: 'https://api.example.test',
    getInitData: () => 'telegram-init-data',
    fetch: async (url) => {
      if (url.endsWith('/api/miniapp/session')) return response(200, { session_token: 'secret-token' });
      if (url.endsWith('/api/user')) return response(200, {
        user: { id: '1', name: 'Solo User' },
        subscription: { active: true, status: 'active', days_left: 30 },
        device_limit: 2,
        connected_devices: 1,
        tariff_name: '',
      });
      return response(200, { period_prices: {} });
    },
  });

  const snapshot = await adapter.fetchProfileSubscription();
  assert.equal(snapshot.subscription.plan.title, 'SOLO');
  assert.equal(snapshot.subscription.plan.emoji, '👻');
  assert.equal(snapshot.subscription.remainingDays, 30);
});

test('real Block 1 maps Flex Squad to lightning emoji and dated VIP to diamond emoji', async () => {
  const flexAdapter = createRealBlock1Adapter({
    apiBase: 'https://api.example.test',
    getInitData: () => 'telegram-init-data',
    fetch: async (url) => {
      if (url.endsWith('/api/miniapp/session')) return response(200, { session_token: 'secret-token' });
      if (url.endsWith('/api/user')) return response(200, {
        user: { id: '1', name: 'Flex User' },
        subscription: { active: true, status: 'active', days_left: 15 },
        device_limit: 3,
        connected_devices: 1,
        tariff_name: 'Flex Squad',
      });
      return response(200, { period_prices: {} });
    },
  });

  const flexSnapshot = await flexAdapter.fetchProfileSubscription();
  assert.equal(flexSnapshot.subscription.plan.title, 'Flex Squad');
  assert.equal(flexSnapshot.subscription.plan.emoji, '⚡');

  const vipAdapter = createRealBlock1Adapter({
    apiBase: 'https://api.example.test',
    getInitData: () => 'telegram-init-data',
    fetch: async (url) => {
      if (url.endsWith('/api/miniapp/session')) return response(200, { session_token: 'secret-token' });
      if (url.endsWith('/api/user')) return response(200, {
        user: { id: '2', name: 'Dated VIP' },
        subscription: { active: true, status: 'active', days_left: 60, expiry: '2026-10-22' },
        device_limit: 5,
        connected_devices: 2,
        tariff_name: 'VIP',
      });
      return response(200, { period_prices: {} });
    },
  });

  const vipSnapshot = await vipAdapter.fetchProfileSubscription();
  assert.equal(vipSnapshot.subscription.plan.title, 'VIP');
  assert.equal(vipSnapshot.subscription.plan.emoji, '💎');
  assert.equal(vipSnapshot.subscription.remainingDays, 60);
});

test('real Block 1 maps Nikita dated VIP preserving remaining days 119 and diamond emoji', async () => {
  const adapter = createRealBlock1Adapter({
    apiBase: 'https://api.example.test',
    getInitData: () => 'telegram-init-data',
    fetch: async (url) => {
      if (url.endsWith('/api/miniapp/session')) return response(200, { session_token: 'secret-token' });
      if (url.endsWith('/api/user')) return response(200, {
        user: { id: '1019746211', name: 'Никита', username: 'Nikkall11' },
        subscription: {
          active: true,
          expiry: '2026-12-20',
          expiry_human: '20.12.2026',
          days_left: 119,
          status: 'vip',
        },
        tariff_name: 'VIP',
        member_tier: 'vip',
        device_limit: 3,
        connected_devices: 2,
      });
      return response(200, { period_prices: {} });
    },
  });

  const snapshot = await adapter.fetchProfileSubscription();
  assert.equal(snapshot.subscription.state, 'vip');
  assert.equal(snapshot.subscription.active, true);
  assert.equal(snapshot.subscription.isTimeless, false);
  assert.equal(snapshot.subscription.expiry, '2026-12-20');
  assert.equal(snapshot.subscription.remainingDays, 119);
  assert.equal(snapshot.subscription.plan.title, 'VIP');
  assert.equal(snapshot.subscription.plan.emoji, '💎');
  assert.equal(snapshot.subscription.deviceLimit, 3);
  assert.equal(snapshot.subscription.usedDevices, 2);
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

test('Generation Guard prevents slow openSession response from overwriting newer token', async () => {
  let sessionCallCount = 0;

  const adapter = createRealBlock1Adapter({
    apiBase: 'https://api.example.test',
    getInitData: () => 'telegram-init-data',
    fetch: async (url) => {
      if (url.endsWith('/api/miniapp/session')) {
        sessionCallCount++;
        const currentCall = sessionCallCount;
        if (currentCall === 1) {
          // Slow session request #1 (takes 150ms, returns token-1)
          await new Promise((r) => setTimeout(r, 150));
          return response(200, { ok: true, session_token: 'token-generation-1' });
        } else {
          // Fast session request #2 (takes 40ms, returns token-2)
          await new Promise((r) => setTimeout(r, 40));
          return response(200, { ok: true, session_token: 'token-generation-2' });
        }
      }
      if (url.endsWith('/api/user')) {
        return response(200, {
          user: { id: '123', name: 'Real User' },
          subscription: { active: true, status: 'active', days_left: 30 },
          tariff_name: 'Solo Ghost',
          device_limit: 2,
          connected_devices: 1,
        });
      }
      if (url.endsWith('/api/tariffs')) {
        return response(200, { period_prices: {} });
      }
      return response(200, {});
    },
  });

  // 1. Launch request #1 (slow session)
  void adapter.fetchProfileSubscription();

  // 2. Wait 20ms, then launch refresh() (request #2, fast session)
  await new Promise((r) => setTimeout(r, 20));
  const req2 = adapter.refresh();

  // 3. Await request #2 completion (resolves at ~60ms)
  await req2;
  assert.equal(adapter.getToken(), 'token-generation-2');

  // 4. Wait until 180ms when slow request #1 session finishes
  await new Promise((r) => setTimeout(r, 120));

  // 5. Verify token was NOT overwritten by late response from request #1
  assert.equal(adapter.getToken(), 'token-generation-2');
});


