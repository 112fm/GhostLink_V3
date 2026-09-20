const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { showSessionError, hideSessionError, initHomeModule } = require(path.join(root, 'src', 'modules', 'home.js'));

function createMockDom() {
  const elements = new Map();
  const listeners = new Map();

  const makeElement = (id) => {
    const classListSet = new Set(['hidden']);
    return {
      id,
      textContent: '',
      dataset: {},
      disabled: false,
      style: { setProperty: () => {} },
      setAttribute: () => {},
      classList: {
        add: (...names) => names.forEach((n) => classListSet.add(n)),
        remove: (...names) => names.forEach((n) => classListSet.delete(n)),
        toggle: (n, force) => {
          if (force) classListSet.add(n);
          else classListSet.delete(n);
        },
        contains: (n) => classListSet.has(n),
      },
      addEventListener: (evt, cb) => {
        if (!listeners.has(id)) listeners.set(id, new Map());
        listeners.get(id).set(evt, cb);
      },
      click: async () => {
        const handler = listeners.get(id)?.get('click');
        if (handler) await handler({ preventDefault: () => {} });
      },
    };
  };

  const getElement = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };

  const bodyClasses = new Set();
  const doc = {
    body: {
      classList: {
        add: (...names) => names.forEach((n) => bodyClasses.add(n)),
        remove: (...names) => names.forEach((n) => bodyClasses.delete(n)),
        contains: (n) => bodyClasses.has(n),
      },
    },
    getElementById: getElement,
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  return { doc, getElement };
}

test('showSessionError reveals overlay and updates message and emoji for auth, timeout, and network errors', () => {
  const { doc, getElement } = createMockDom();

  // Network error
  showSessionError({ type: 'network', message: 'Не удалось связаться с GhostLink' }, doc);
  assert.equal(getElement('page-session-error').classList.contains('hidden'), false);
  assert.equal(doc.body.classList.contains('has-overlay-open'), true);
  assert.equal(getElement('sessionErrorTitle').textContent, 'Связь с GhostLink прервана');
  assert.equal(getElement('sessionErrorEmoji').textContent, '📡');

  // Timeout error
  showSessionError({ type: 'timeout' }, doc);
  assert.equal(getElement('sessionErrorTitle').textContent, 'Сервер не отвечает');
  assert.equal(getElement('sessionErrorEmoji').textContent, '⏱️');

  // Auth error (401)
  showSessionError({ type: 'auth', status: 401, message: 'Сессия не подтверждена' }, doc);
  assert.equal(getElement('sessionErrorTitle').textContent, 'Требуется авторизация');
  assert.equal(getElement('sessionErrorEmoji').textContent, '🔐');

  // Hide overlay
  hideSessionError(doc);
  assert.equal(getElement('page-session-error').classList.contains('hidden'), true);
  assert.equal(doc.body.classList.contains('has-overlay-open'), false);
});

test('btnSessionRetry triggers profile reload and clears session error overlay on success', async () => {
  const { doc, getElement } = createMockDom();
  const prevDoc = global.document;
  global.document = doc;

  let fetchCount = 0;
  let shouldFail = true;

  try {
    initHomeModule({
      profileSubscription: {
        fetchProfileSubscription: async () => {
          fetchCount++;
          if (shouldFail) {
            const err = new Error('Network failure');
            err.type = 'network';
            throw err;
          }
          return {
            isMock: false,
            subscription: {
              state: 'active',
              active: true,
              remainingDays: 30,
              totalDays: 30,
              plan: { title: 'Solo', emoji: '👻' },
            },
          };
        },
      },
    });

    // Initial load failed
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(fetchCount, 1);
    assert.equal(getElement('page-session-error').classList.contains('hidden'), false);

    // Click retry button with recovered connection
    shouldFail = false;
    await getElement('btnSessionRetry').click();

    assert.equal(fetchCount, 2);
    assert.equal(getElement('page-session-error').classList.contains('hidden'), true);
    assert.equal(doc.body.classList.contains('has-overlay-open'), false);
  } finally {
    global.document = prevDoc;
  }
});

test('Stale-While-Revalidate preserves rendered profile and does NOT show session error overlay on background fetch failure', async () => {
  const { doc, getElement } = createMockDom();
  const prevDoc = global.document;
  global.document = doc;

  let fetchCount = 0;
  let failSecond = false;

  try {
    const home = initHomeModule({
      profileSubscription: {
        fetchProfileSubscription: async () => {
          fetchCount++;
          if (failSecond) {
            const err = new Error('Timeout');
            err.type = 'timeout';
            throw err;
          }
          return {
            isMock: false,
            subscription: {
              state: 'active',
              active: true,
              remainingDays: 45,
              totalDays: 60,
              plan: { title: 'Flex', emoji: '⚡' },
            },
          };
        },
      },
    });

    // 1. Initial load succeeds
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(fetchCount, 1);
    assert.equal(getElement('page-session-error').classList.contains('hidden'), true);
    assert.equal(getElement('subscriptionPlanName').textContent, 'Flex');

    // 2. Background refresh fails (e.g. timeout on mobile network)
    failSecond = true;
    await home.loadProfileSubscription({ force: true });

    // 3. Error modal is NOT shown because valid profile was already rendered
    assert.equal(getElement('page-session-error').classList.contains('hidden'), true);
    assert.equal(doc.body.classList.contains('has-overlay-open'), false);
    // Rendered profile is preserved
    assert.equal(getElement('subscriptionPlanName').textContent, 'Flex');
  } finally {
    global.document = prevDoc;
  }
});

test('renderSubscriptionStatus does not overwrite valid rendered profile with СЕРВЕР НЕДОСТУПЕН on secondary error', async () => {
  const { doc, getElement } = createMockDom();
  const prevDoc = global.document;
  global.document = doc;

  try {
    const { renderSubscriptionStatus } = require(path.join(root, 'src', 'modules', 'home.js'));

    // 1. Initial valid profile render
    renderSubscriptionStatus({
      subscription: {
        state: 'active',
        active: true,
        remainingDays: 20,
        plan: { title: 'Solo', emoji: '👻' },
      },
    }, doc);
    assert.equal(getElement('subscriptionPlanName').textContent, 'Solo');
    assert.equal(getElement('subscriptionEmoji').textContent, '👻');

    // 2. Secondary error arrives (e.g. 500 error from background check)
    renderSubscriptionStatus({
      error: { status: 500, type: 'api', message: 'Internal Server Error' },
    }, doc);

    // 3. Must NOT show 'СЕРВЕР НЕДОСТУПЕН' and must preserve existing data
    assert.notEqual(getElement('subscriptionPlanName').textContent, 'СЕРВЕР НЕДОСТУПЕН');
    assert.equal(getElement('subscriptionPlanName').textContent, 'Solo');
    assert.equal(getElement('subscriptionEmoji').textContent, '👻');
  } finally {
    global.document = prevDoc;
  }
});

test('btnSessionRetry clears inFlight on adapter and requests with { force: true, reauth: true }', async () => {
  const { doc, getElement } = createMockDom();
  const prevDoc = global.document;
  global.document = doc;

  let clearInFlightCalled = 0;
  let receivedOptions = null;
  let fetchCount = 0;

  try {
    initHomeModule({
      profileSubscription: {
        clearInFlight: () => {
          clearInFlightCalled++;
        },
        fetchProfileSubscription: async (options) => {
          fetchCount++;
          receivedOptions = options;
          if (fetchCount === 1) {
            const err = new Error('Session timeout');
            err.type = 'timeout';
            throw err;
          }
          return {
            subscription: { state: 'active', active: true, plan: { title: 'Solo' } },
          };
        },
      },
    });

    await new Promise((r) => setTimeout(r, 10));
    assert.equal(fetchCount, 1);
    assert.equal(getElement('page-session-error').classList.contains('hidden'), false);

    // Click retry
    await getElement('btnSessionRetry').click();

    assert.equal(fetchCount, 2);
    assert.ok(clearInFlightCalled >= 1);
    assert.deepEqual(receivedOptions, { force: true, reauth: true });
    assert.equal(getElement('page-session-error').classList.contains('hidden'), true);
  } finally {
    global.document = prevDoc;
  }
});

test('slow connection displays "Подключаемся к GhostLink…" after delay when loading without cached profile', async () => {
  const { doc, getElement } = createMockDom();
  const prevDoc = global.document;
  global.document = doc;

  let resolveProfile;
  const profilePromise = new Promise((resolve) => {
    resolveProfile = resolve;
  });

  try {
    initHomeModule({
      slowConnectionDelayMs: 25,
      profileSubscription: {
        fetchProfileSubscription: () => profilePromise,
      },
    });

    // Before delay threshold: loading is active, but hint is not yet shown
    assert.equal(getElement('subscriptionStatus').classList.contains('is-subscription-loading'), true);
    assert.equal(getElement('subscriptionStatus').classList.contains('has-loading-hint'), false);
    assert.equal(getElement('subscriptionPlanName').textContent, '');

    // Wait past 25ms delay
    await new Promise((r) => setTimeout(r, 35));

    // After delay: hint is shown in subscription island
    assert.equal(getElement('subscriptionStatus').classList.contains('has-loading-hint'), true);
    assert.equal(getElement('subscriptionPlanName').textContent, 'Подключаемся к GhostLink…');
    assert.equal(getElement('subscriptionEmoji').textContent, '📡');

    // Resolve profile
    resolveProfile({
      subscription: {
        state: 'active',
        active: true,
        remainingDays: 14,
        plan: { title: 'Flex', emoji: '⚡' },
      },
    });
    await new Promise((r) => setTimeout(r, 10));

    // Once resolved, loading and hint classes are cleared and profile is rendered
    assert.equal(getElement('subscriptionStatus').classList.contains('has-loading-hint'), false);
    assert.equal(getElement('subscriptionStatus').classList.contains('is-subscription-loading'), false);
    assert.equal(getElement('subscriptionPlanName').textContent, 'Flex');
    assert.equal(getElement('subscriptionEmoji').textContent, '⚡');
  } finally {
    global.document = prevDoc;
  }
});
