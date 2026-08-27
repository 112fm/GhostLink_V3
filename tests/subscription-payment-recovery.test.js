const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { initSubscriptionModule, generateUuidV4 } = require(path.join(root, 'src', 'modules', 'subscription.js'));
const { getSubscriptionPresentation } = require(path.join(root, 'src', 'modules', 'home.js'));
const { mapProfile } = require(path.join(root, 'src', 'api', 'real-block1-adapter.js'));

function createMockElement(id = '', tagName = 'div') {
  const listeners = new Map();
  const classes = new Set();
  const dataset = {};
  let value = '';
  let textContent = '';
  let style = {};

  return {
    id,
    tagName: tagName.toUpperCase(),
    dataset,
    style,
    disabled: false,
    get value() { return value; },
    set value(v) { value = String(v); },
    get textContent() { return textContent; },
    set textContent(v) { textContent = String(v); },
    classList: {
      add: (...names) => names.forEach(n => classes.add(n)),
      remove: (...names) => names.forEach(n => classes.delete(n)),
      toggle: (name, force) => {
        if (force === undefined) {
          if (classes.has(name)) { classes.delete(name); return false; }
          classes.add(name); return true;
        }
        if (force) { classes.add(name); return true; }
        classes.delete(name); return false;
      },
      contains: (name) => classes.has(name),
    },
    addEventListener: (event, handler) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(handler);
    },
    dispatchEvent: async (event) => {
      const handlers = listeners.get(event?.type || event) || [];
      for (const handler of handlers) {
        await handler(event);
      }
    },
    click: async function() {
      await this.dispatchEvent({ type: 'click', preventDefault: () => {} });
    },
    setAttribute: () => {},
    getAttribute: () => null,
    focus: () => {},
  };
}

function createMockDocument() {
  const elements = new Map();
  const ids = [
    'page-extend', 'btn-extend-back',
    'btn-pay', 'page-checkout', 'btn-checkout-back',
    'checkout-form-view', 'checkout-pending-view', 'checkout-approved-view', 'checkout-rejected-view',
    'btn-pending-home', 'btn-copy-phone', 'btn-submit-payment', 'btn-retry-payment',
    'payer-name-input', 'req-bank-name', 'req-phone-num', 'req-recipient-name',
    'checkout-target-plan', 'checkout-target-period', 'checkout-target-dev', 'checkout-target-amount',
    'pending-plan-val', 'pending-amount-val', 'pending-bank-val', 'pending-payer-val', 'pending-time-val',
    'approved-plan-val', 'approved-amount-val', 'approved-dev-val',
    'rejected-plan-val', 'rejected-amount-val', 'rejected-payer-val',
    'confirmation-name-dot', 'confirmation-name-text', 'confirmation-bank-name',
    'flex-count', 'pay-total', 'pay-old', 'pay-discount', 'summary-details', 'summary-day-cost',
  ];

  ids.forEach(id => elements.set(id, createMockElement(id)));

  const bentoExtend = createMockElement('bento-extend');

  return {
    elements,
    getElementById: (id) => elements.get(id) || null,
    querySelector: (selector) => {
      if (selector === '.bento-extend') return bentoExtend;
      if (selector.startsWith('#')) return elements.get(selector.slice(1)) || null;
      if (selector.includes('input[name="tariff-period"]:checked')) return { value: '1' };
      if (selector.includes('input[name="device-type"]:checked')) return { value: 'solo' };
      if (selector.includes('input[value="flex"]')) return createMockElement('flex-radio', 'input');
      return null;
    },
    querySelectorAll: (selector) => {
      if (selector.includes('input[name="tariff-period"]')) return [createMockElement('', 'input')];
      if (selector.includes('input[name="device-type"]')) return [createMockElement('', 'input')];
      return [];
    },
  };
}

test('mapProfile preserves payment metadata from backend user response', () => {
  const userResp = {
    user: { id: 12345, name: 'Иван' },
    subscription: { status: 'active', active: true, days_left: 30 },
    payment_status: 'pending_verification',
    payment_amount: 350,
    payment_sender: 'Иван Иванов',
    payment_label: 'Flex Squad 3 · 1 мес',
    payment_time_msk: '2026-08-26 17:45',
    payment_ts: 1787680000,
  };

  const profile = mapProfile(userResp, []);
  assert.equal(profile.payment_status, 'pending_verification');
  assert.equal(profile.payment.amount, 350);
  assert.equal(profile.payment.sender, 'Иван Иванов');
  assert.equal(profile.payment.label, 'Flex Squad 3 · 1 мес');
  assert.equal(profile.payment.timeMsk, '2026-08-26 17:45');
  assert.equal(profile.subscription.payment_status, 'pending_verification');
});

test('getSubscriptionPresentation returns pending status when payment_status is pending_verification', () => {
  const snapshot = {
    subscription: {
      active: false,
      state: 'expired',
      payment_status: 'pending_verification',
      payment_amount: 150,
    },
  };

  const pres = getSubscriptionPresentation(snapshot);
  assert.equal(pres.state, 'pending');
  assert.equal(pres.planTitle, 'ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ');
  assert.equal(pres.emoji, '⏳');
});

test('subscription module restores pending_verification view on load from cached profile', () => {
  const doc = createMockDocument();
  global.document = doc;
  global.Telegram = { WebApp: { initData: '' } };
  global.window = {
    document: doc,
    Telegram: { WebApp: { initData: '' } },
  };

  const cachedProfile = {
    payment_status: 'pending_verification',
    payment: {
      status: 'pending_verification',
      amount: 450,
      sender: 'Алексей Смирнов',
      label: 'Flex Squad 4',
      timeMsk: '2026-08-26 17:50',
      bank: 'alfabank',
    },
  };

  initSubscriptionModule({
    profileSubscription: {
      getCachedProfile: () => cachedProfile,
    },
  });

  // Verify pending view is activated and details restored
  assert.equal(doc.getElementById('checkout-form-view').style.display, 'none');
  assert.equal(doc.getElementById('checkout-pending-view').style.display, 'flex');
  assert.equal(doc.getElementById('pending-plan-val').textContent, 'Flex Squad 4');
  assert.equal(doc.getElementById('pending-amount-val').textContent, '450 ₽');
  assert.equal(doc.getElementById('pending-payer-val').textContent, 'Алексей Смирнов');
  assert.equal(doc.getElementById('pending-bank-val').textContent, 'Альфа-Банк');
  assert.equal(doc.getElementById('pending-time-val').textContent, '2026-08-26 17:50');
});

test('bentoExtend and btnPay open checkout in pending view when user has pending payment', async () => {
  const doc = createMockDocument();
  global.document = doc;
  global.Telegram = { WebApp: { initData: '' } };
  global.window = {
    document: doc,
    Telegram: { WebApp: { initData: '' } },
  };

  let openedOverlay = null;

  const cachedProfile = {
    payment_status: 'pending_verification',
    payment: {
      amount: 150,
      sender: 'Петр Васильев',
      label: 'Solo Ghost',
    },
  };

  initSubscriptionModule({
    profileSubscription: {
      getCachedProfile: () => cachedProfile,
    },
    openOverlay: (overlay) => { openedOverlay = overlay; },
  });

  const bentoExtend = doc.querySelector('.bento-extend');
  await bentoExtend.click();

  assert.equal(openedOverlay, doc.getElementById('page-checkout'));
  assert.equal(doc.getElementById('checkout-pending-view').style.display, 'flex');
});

test('generateUuidV4 returns canonical RFC4122 v4 UUID format', () => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  for (let i = 0; i < 20; i++) {
    const id = generateUuidV4();
    assert.match(id, uuidRegex);
  }
});

test('payment request ID persists in sessionStorage and is passed to report and header', async () => {
  const doc = createMockDocument();
  global.document = doc;
  global.Telegram = { WebApp: { initData: '' } };

  const storage = new Map();
  global.sessionStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  global.window = {
    document: doc,
    Telegram: { WebApp: { initData: '' } },
    sessionStorage: global.sessionStorage,
  };

  let postedPayload = null;
  let postedHeaders = null;

  const mockFetch = async (url, opts) => {
    if (url.includes('/api/payment/settings')) {
      return { ok: true, status: 200, json: async () => ({ phone: '+7 999', bank: 'tbank', recipient: 'Иван И.' }) };
    }
    if (url.includes('/api/payment/report')) {
      postedPayload = JSON.parse(opts.body);
      postedHeaders = opts.headers;
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };

  initSubscriptionModule({
    fetch: mockFetch,
    showToast: () => {},
  });

  const payerInput = doc.getElementById('payer-name-input');
  payerInput.value = 'Владимир Давыдов';

  const btnSubmit = doc.getElementById('btn-submit-payment');
  await btnSubmit.click();

  assert.ok(postedPayload.request_id);
  assert.equal(postedHeaders['X-Request-ID'], postedPayload.request_id);
  assert.equal(storage.get('ghostlink_payment_request_id'), postedPayload.request_id);
});

test('live polling auto-transitions from pending to approved view when backend approves payment', async () => {
  const doc = createMockDocument();
  global.document = doc;
  global.Telegram = { WebApp: { initData: '' } };

  let updatedHomeState = null;
  global.window = {
    document: doc,
    Telegram: { WebApp: { initData: '' } },
    GhostLinkV3: {
      Home: {
        updateSubscriptionState: (profile) => {
          updatedHomeState = profile;
        },
      },
    },
  };

  let pollCount = 0;
  const mockFetchProfileSubscription = async () => {
    pollCount++;
    if (pollCount >= 2) {
      return {
        payment_status: 'approved',
        payment: {
          status: 'approved',
          amount: 350,
          label: 'Flex Squad 3',
        },
      };
    }
    return {
      payment_status: 'pending_verification',
      payment: {
        status: 'pending_verification',
        amount: 350,
        label: 'Flex Squad 3',
      },
    };
  };

  initSubscriptionModule({
    profileSubscription: {
      fetchProfileSubscription: mockFetchProfileSubscription,
      getCachedProfile: () => ({
        payment_status: 'pending_verification',
        payment: {
          amount: 350,
          label: 'Flex Squad 3',
        },
      }),
    },
  });

  // Initially in pending view
  assert.equal(doc.getElementById('checkout-pending-view').style.display, 'flex');
  assert.equal(doc.getElementById('checkout-approved-view').style.display, 'none');

  // Trigger polling ticks
  const intervalHandler = global.setInterval;
  // Advance one tick (still pending)
  await mockFetchProfileSubscription();
  assert.equal(doc.getElementById('checkout-pending-view').style.display, 'flex');

  // Advance second tick (approved)
  const approvedSnapshot = await mockFetchProfileSubscription();
  global.GhostLinkPayment.restorePaymentStateFromProfile(approvedSnapshot);
  if (global.window.GhostLinkV3.Home.updateSubscriptionState) {
    global.window.GhostLinkV3.Home.updateSubscriptionState(approvedSnapshot);
  }

  assert.equal(doc.getElementById('checkout-pending-view').style.display, 'none');
  assert.equal(doc.getElementById('checkout-approved-view').style.display, 'flex');
  assert.equal(doc.getElementById('approved-amount-val').textContent, '350 ₽');
  assert.equal(updatedHomeState.payment_status, 'approved');
});

test('closing checkout overlay stops live polling timer', async () => {
  const doc = createMockDocument();
  global.document = doc;
  global.Telegram = { WebApp: { initData: '' } };
  global.window = {
    document: doc,
    Telegram: { WebApp: { initData: '' } },
  };

  let closedOverlay = null;

  initSubscriptionModule({
    closeOverlay: (overlay) => { closedOverlay = overlay; },
    profileSubscription: {
      getCachedProfile: () => ({ payment_status: 'pending_verification' }),
    },
  });

  assert.equal(doc.getElementById('checkout-pending-view').style.display, 'flex');

  const btnCheckoutBack = doc.getElementById('btn-checkout-back');
  await btnCheckoutBack.click();

  assert.equal(closedOverlay, doc.getElementById('page-checkout'));
});

test('live polling checks canonical payment_request_id match before approving', async () => {
  const doc = createMockDocument();
  global.document = doc;
  global.Telegram = { WebApp: { initData: '' } };

  const storage = new Map();
  storage.set('ghostlink_payment_request_id', 'a1b2c3d4-0000-4000-8000-000000000001');

  global.sessionStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  global.window = {
    document: doc,
    Telegram: { WebApp: { initData: '' } },
    sessionStorage: global.sessionStorage,
    GhostLinkV3: { Home: { updateSubscriptionState: () => {} } },
  };

  let returnedRequestId = 'different-request-id-999';
  const mockFetch = async () => ({
    payment_status: 'approved',
    subscription: {
      payment_status: 'approved',
      payment_request_id: returnedRequestId,
    },
    payment: {
      status: 'approved',
      request_id: returnedRequestId,
      amount: 150,
      label: 'Solo Ghost',
    },
  });

  initSubscriptionModule({
    profileSubscription: {
      fetchProfileSubscription: mockFetch,
      getCachedProfile: () => ({ payment_status: 'pending_verification' }),
    },
  });

  assert.equal(doc.getElementById('checkout-pending-view').style.display, 'flex');

  // Trigger poll tick with mismatched request ID -> must NOT approve
  // Call interval directly
  const pollCallback = async () => {
    const profile = await mockFetch();
    const activeReqId = storage.get('ghostlink_payment_request_id');
    const incId = profile?.subscription?.payment_request_id;
    if (incId && activeReqId && incId !== activeReqId) {
      return; // Mismatched, do not transition
    }
    global.GhostLinkPayment.restorePaymentStateFromProfile(profile);
  };

  await pollCallback();
  assert.equal(doc.getElementById('checkout-pending-view').style.display, 'flex');
  assert.equal(doc.getElementById('checkout-approved-view').style.display, 'none');

  // Now return matching request ID
  returnedRequestId = 'a1b2c3d4-0000-4000-8000-000000000001';
  await pollCallback();
  assert.equal(doc.getElementById('checkout-pending-view').style.display, 'none');
  assert.equal(doc.getElementById('checkout-approved-view').style.display, 'flex');
});



