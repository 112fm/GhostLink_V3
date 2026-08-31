const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
require(path.join(root, 'src', 'mocks', 'admin-security.js'));
const { initAdminPaymentSettingsModule } = require(path.join(root, 'src', 'modules', 'admin-payment-settings.js'));

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
    closest: function() { return { remove: () => { this.removed = true; } }; },
    querySelector: () => null,
    querySelectorAll: () => [],
    remove: function() { this.removed = true; },
  };
}

function createMockAdminDoc() {
  const elements = new Map();
  const ids = [
    'btnOpenPaymentSettings', 'page-admin-payment-settings', 'paymentSettingsForm',
    'btnPaymentSettingsBack', 'btnCancelPaymentSettings', 'btnSavePaymentSettings',
    'paymentSettingsMethod', 'paymentSettingsBank', 'paymentSettingsPhone', 'paymentSettingsCard',
    'paymentSettingsRecipientFirstName', 'paymentSettingsRecipientLastInitial',
    'paymentSettingsInstruction', 'paymentSettingsStatus', 'paymentSettingsPhoneField',
    'paymentSettingsCardField', 'paymentSettingsFormStatus', 'paymentSettingsEntrySummary',
    'paymentSettingsVersion', 'paymentSettingsPreviewMethod', 'paymentSettingsPreviewBank',
    'paymentSettingsPreviewDestinationLabel', 'paymentSettingsPreviewDestination',
    'paymentSettingsPreviewRecipient', 'paymentSettingsPreviewInstruction',
    'paymentSettingsErrorBanner', 'btnRetryPaymentSettings',
  ];

  ids.forEach(id => elements.set(id, createMockElement(id)));

  return {
    elements,
    getElementById: (id) => elements.get(id) || null,
    querySelector: (sel) => elements.get(sel.replace('#', '')) || null,
    querySelectorAll: () => [],
  };
}

test('admin payment settings opens overlay and loads GET /api/payment/settings', async () => {
  const doc = createMockAdminDoc();
  global.document = doc;
  global.Telegram = { WebApp: { initData: 'admin-init-data' } };
  global.GhostLinkV3 = {
    adminMockSession: { isAdmin: () => true, assertAdmin: () => true },
  };
  global.window = {
    document: doc,
    Telegram: { WebApp: { initData: 'admin-init-data' } },
    GhostLinkV3: global.GhostLinkV3,
  };

  let fetchedUrl = '';
  let openedOverlay = null;

  const mockFetch = async (url) => {
    fetchedUrl = url;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        phone: '+7 985 771-91-39',
        bank: 'alfa',
        recipient: 'Арсений А.',
      }),
    };
  };

  initAdminPaymentSettingsModule({
    fetch: mockFetch,
    apiBase: 'https://api.test.ru',
    openOverlay: (page) => { openedOverlay = page; },
    profileSubscription: { getToken: () => 'admin-token-123' },
  });

  const openBtn = doc.getElementById('btnOpenPaymentSettings');
  await openBtn.click();

  assert.equal(openedOverlay, doc.getElementById('page-admin-payment-settings'));
  assert.equal(fetchedUrl, 'https://api.test.ru/api/payment/settings');
  assert.equal(doc.getElementById('paymentSettingsBank').value, 'alfabank');
  assert.equal(doc.getElementById('paymentSettingsPhone').value, '+7 985 771-91-39');
  assert.equal(doc.getElementById('paymentSettingsRecipientFirstName').value, 'Арсений');
  assert.equal(doc.getElementById('paymentSettingsRecipientLastInitial').value, 'А');
});

test('admin payment settings submits POST /api/admin/payment/settings and shows success toast', async () => {
  const doc = createMockAdminDoc();
  global.document = doc;
  global.Telegram = { WebApp: { initData: 'admin-init-data' } };
  global.GhostLinkV3 = {
    adminMockSession: { isAdmin: () => true, assertAdmin: () => true },
  };
  global.window = {
    document: doc,
    Telegram: { WebApp: { initData: 'admin-init-data' } },
    GhostLinkV3: global.GhostLinkV3,
  };

  let postedUrl = '';
  let postedBody = null;
  let toastMsg = '';

  const mockFetch = async (url, options) => {
    if (url.includes('/api/payment/settings')) {
      return { ok: true, status: 200, json: async () => ({ phone: '+7 985 771-91-39', bank: 'alfa', recipient: 'Арсений А.' }) };
    }
    postedUrl = url;
    postedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    };
  };

  initAdminPaymentSettingsModule({
    fetch: mockFetch,
    apiBase: 'https://api.test.ru',
    showToast: (msg) => { toastMsg = msg; },
    profileSubscription: { getToken: () => 'admin-token-123' },
    openOverlay: () => {},
  });

  const openBtn = doc.getElementById('btnOpenPaymentSettings');
  await openBtn.click();

  doc.getElementById('paymentSettingsMethod').value = 'sbp_phone';
  doc.getElementById('paymentSettingsBank').value = 'alfabank';
  doc.getElementById('paymentSettingsPhone').value = '+7 985 771-91-39';
  doc.getElementById('paymentSettingsRecipientFirstName').value = 'Арсений';
  doc.getElementById('paymentSettingsRecipientLastInitial').value = 'А';
  doc.getElementById('paymentSettingsInstruction').value = 'Без комментария';
  doc.getElementById('paymentSettingsStatus').value = 'active';

  const form = doc.getElementById('paymentSettingsForm');
  await form.dispatchEvent({ type: 'submit', preventDefault: () => {} });

  assert.equal(postedUrl, 'https://api.test.ru/api/admin/payment/settings');
  assert.equal(postedBody.phone, '+7 985 771-91-39');
  assert.equal(postedBody.bank, 'alfabank');
  assert.equal(postedBody.recipient, 'Арсений А.');
  assert.equal(toastMsg, 'Реквизиты успешно обновлены в базе');
});

test('admin payment settings preserves elements in DOM without destructive removal', () => {
  const doc = createMockAdminDoc();
  global.document = doc;
  global.Telegram = { WebApp: { initData: '' } };
  delete global.GhostLinkV3;
  global.window = {
    document: doc,
    Telegram: { WebApp: { initData: '' } },
  };

  initAdminPaymentSettingsModule({
    isAdmin: false,
  });

  assert.equal(doc.getElementById('btnOpenPaymentSettings').removed, undefined);
  assert.equal(doc.getElementById('page-admin-payment-settings').removed, undefined);
});

test('security regression: non-admin form submit enforces strict default-deny with zero fetch calls', async () => {
  const doc = createMockAdminDoc();
  global.document = doc;
  global.Telegram = { WebApp: { initData: '' } };
  delete global.GhostLinkV3;
  global.window = {
    document: doc,
    Telegram: { WebApp: { initData: '' } },
  };

  let fetchCallsCount = 0;
  let toastMsg = '';

  const mockFetch = async (url) => {
    if (url.includes('/api/payment/settings')) {
      return { ok: true, status: 200, json: async () => ({ phone: '+7 985 771-91-39', bank: 'alfa', recipient: 'Арсений А.' }) };
    }
    fetchCallsCount += 1;
    return { ok: true, status: 200, json: async () => ({}) };
  };

  initAdminPaymentSettingsModule({
    isAdmin: false,
    fetch: mockFetch,
    showToast: (msg) => { toastMsg = msg; },
    profileSubscription: {
      getCachedProfile: () => ({ user: { is_admin: false } }),
      getSnapshot: () => ({ user: { is_admin: false } }),
      getToken: () => '',
    },
    openOverlay: () => {},
  });

  const openBtn = doc.getElementById('btnOpenPaymentSettings');
  await openBtn.click();

  doc.getElementById('paymentSettingsMethod').value = 'sbp_phone';
  doc.getElementById('paymentSettingsBank').value = 'alfabank';
  doc.getElementById('paymentSettingsPhone').value = '+7 985 771-91-39';
  doc.getElementById('paymentSettingsRecipientFirstName').value = 'Арсений';
  doc.getElementById('paymentSettingsRecipientLastInitial').value = 'А';
  doc.getElementById('paymentSettingsInstruction').value = 'Без комментария';
  doc.getElementById('paymentSettingsStatus').value = 'active';

  const form = doc.getElementById('paymentSettingsForm');
  await form.dispatchEvent({ type: 'submit', preventDefault: () => {} });

  assert.equal(fetchCallsCount, 0, 'No network requests should be dispatched when not admin');
  assert.equal(toastMsg, 'Доступ только для администратора');
  assert.equal(doc.getElementById('paymentSettingsFormStatus').textContent, 'Недостаточно прав администратора');
});

test('resolveIsAdmin callback function: isAdmin () => false strictly denies access with zero fetch calls', async () => {
  const doc = createMockAdminDoc();
  global.document = doc;
  global.Telegram = { WebApp: { initData: '' } };
  delete global.GhostLinkV3;
  global.window = {
    document: doc,
    Telegram: { WebApp: { initData: '' } },
  };

  let fetchCallsCount = 0;
  let toastMsg = '';

  const mockFetch = async (url) => {
    if (url.includes('/api/payment/settings')) {
      return { ok: true, status: 200, json: async () => ({ phone: '+7 985 771-91-39', bank: 'alfa', recipient: 'Арсений А.' }) };
    }
    fetchCallsCount += 1;
    return { ok: true, status: 200, json: async () => ({}) };
  };

  initAdminPaymentSettingsModule({
    isAdmin: () => false,
    fetch: mockFetch,
    showToast: (msg) => { toastMsg = msg; },
    profileSubscription: {
      getCachedProfile: () => null,
      getSnapshot: () => null,
      getToken: () => '',
    },
    openOverlay: () => {},
  });

  const openBtn = doc.getElementById('btnOpenPaymentSettings');
  await openBtn.click();

  doc.getElementById('paymentSettingsMethod').value = 'sbp_phone';
  doc.getElementById('paymentSettingsBank').value = 'alfabank';
  doc.getElementById('paymentSettingsPhone').value = '+7 985 771-91-39';
  doc.getElementById('paymentSettingsRecipientFirstName').value = 'Арсений';
  doc.getElementById('paymentSettingsRecipientLastInitial').value = 'А';
  doc.getElementById('paymentSettingsInstruction').value = 'Без комментария';
  doc.getElementById('paymentSettingsStatus').value = 'active';

  const form = doc.getElementById('paymentSettingsForm');
  await form.dispatchEvent({ type: 'submit', preventDefault: () => {} });

  assert.equal(fetchCallsCount, 0, 'Callback returning false must not allow fetch dispatch');
  assert.equal(toastMsg, 'Доступ только для администратора');
  assert.equal(doc.getElementById('paymentSettingsFormStatus').textContent, 'Недостаточно прав администратора');
});

test('resolveIsAdmin callback function: isAdmin () => true allows form submit and sends POST request', async () => {
  const doc = createMockAdminDoc();
  global.document = doc;
  global.Telegram = { WebApp: { initData: 'admin-init-data' } };
  delete global.GhostLinkV3;
  global.window = {
    document: doc,
    Telegram: { WebApp: { initData: 'admin-init-data' } },
  };

  let postedUrl = '';
  let postedBody = null;
  let toastMsg = '';

  const mockFetch = async (url, options) => {
    if (url.includes('/api/payment/settings')) {
      return { ok: true, status: 200, json: async () => ({ phone: '+7 985 771-91-39', bank: 'alfa', recipient: 'Арсений А.' }) };
    }
    postedUrl = url;
    postedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    };
  };

  initAdminPaymentSettingsModule({
    isAdmin: () => true,
    fetch: mockFetch,
    apiBase: 'https://api.test.ru',
    showToast: (msg) => { toastMsg = msg; },
    profileSubscription: { getToken: () => 'token-admin-func' },
    openOverlay: () => {},
  });

  const openBtn = doc.getElementById('btnOpenPaymentSettings');
  await openBtn.click();

  doc.getElementById('paymentSettingsMethod').value = 'sbp_phone';
  doc.getElementById('paymentSettingsBank').value = 'alfabank';
  doc.getElementById('paymentSettingsPhone').value = '+7 985 771-91-39';
  doc.getElementById('paymentSettingsRecipientFirstName').value = 'Арсений';
  doc.getElementById('paymentSettingsRecipientLastInitial').value = 'А';
  doc.getElementById('paymentSettingsInstruction').value = 'Без комментария';
  doc.getElementById('paymentSettingsStatus').value = 'active';

  const form = doc.getElementById('paymentSettingsForm');
  await form.dispatchEvent({ type: 'submit', preventDefault: () => {} });

  assert.equal(postedUrl, 'https://api.test.ru/api/admin/payment/settings');
  assert.equal(postedBody.phone, '+7 985 771-91-39');
  assert.equal(postedBody.bank, 'alfabank');
  assert.equal(postedBody.recipient, 'Арсений А.');
  assert.equal(toastMsg, 'Реквизиты успешно обновлены в базе');
});

test('safe disabled state: GET /api/payment/settings failure locks all inputs and save button with error banner', async () => {
  const doc = createMockAdminDoc();
  global.document = doc;
  global.Telegram = { WebApp: { initData: 'admin-init-data' } };
  global.GhostLinkV3 = {
    adminMockSession: { isAdmin: () => true, assertAdmin: () => true },
  };
  global.window = {
    document: doc,
    Telegram: { WebApp: { initData: 'admin-init-data' } },
    GhostLinkV3: global.GhostLinkV3,
  };

  const mockFetch = async () => {
    return {
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    };
  };

  initAdminPaymentSettingsModule({
    isAdmin: () => true,
    fetch: mockFetch,
    apiBase: 'https://api.test.ru',
    profileSubscription: { getToken: () => 'token-admin-func' },
    openOverlay: () => {},
  });

  const openBtn = doc.getElementById('btnOpenPaymentSettings');
  await openBtn.click();

  // Verify all form fields and save button are locked (disabled = true)
  assert.equal(doc.getElementById('paymentSettingsMethod').disabled, true);
  assert.equal(doc.getElementById('paymentSettingsBank').disabled, true);
  assert.equal(doc.getElementById('paymentSettingsPhone').disabled, true);
  assert.equal(doc.getElementById('paymentSettingsCard').disabled, true);
  assert.equal(doc.getElementById('paymentSettingsRecipientFirstName').disabled, true);
  assert.equal(doc.getElementById('paymentSettingsRecipientLastInitial').disabled, true);
  assert.equal(doc.getElementById('paymentSettingsInstruction').disabled, true);
  assert.equal(doc.getElementById('paymentSettingsStatus').disabled, true);
  assert.equal(doc.getElementById('btnSavePaymentSettings').disabled, true);

  // Verify error banner is visible and status is shown
  assert.equal(doc.getElementById('paymentSettingsErrorBanner').classList.contains('hidden'), false);
  assert.match(doc.getElementById('paymentSettingsFormStatus').textContent, /Ошибка загрузки с сервера/);
});

test('retry state: clicking btnRetryPaymentSettings retries GET request and unlocks form on success', async () => {
  const doc = createMockAdminDoc();
  global.document = doc;
  global.Telegram = { WebApp: { initData: 'admin-init-data' } };
  global.GhostLinkV3 = {
    adminMockSession: { isAdmin: () => true, assertAdmin: () => true },
  };
  global.window = {
    document: doc,
    Telegram: { WebApp: { initData: 'admin-init-data' } },
    GhostLinkV3: global.GhostLinkV3,
  };

  let attempts = 0;
  const mockFetch = async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error('Network timeout');
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        phone: '+7 999 555-44-33',
        bank: 'tbank',
        recipient: 'Дмитрий Д.',
      }),
    };
  };

  initAdminPaymentSettingsModule({
    isAdmin: () => true,
    fetch: mockFetch,
    apiBase: 'https://api.test.ru',
    profileSubscription: { getToken: () => 'token-admin-func' },
    openOverlay: () => {},
  });

  const openBtn = doc.getElementById('btnOpenPaymentSettings');
  await openBtn.click();

  // First attempt failed: locked
  assert.equal(attempts, 1);
  assert.equal(doc.getElementById('btnSavePaymentSettings').disabled, true);
  assert.equal(doc.getElementById('paymentSettingsErrorBanner').classList.contains('hidden'), false);

  // Click retry button
  const retryBtn = doc.getElementById('btnRetryPaymentSettings');
  await retryBtn.click();

  // Second attempt succeeded: unlocked and populated
  assert.equal(attempts, 2);
  assert.equal(doc.getElementById('paymentSettingsMethod').disabled, false);
  assert.equal(doc.getElementById('paymentSettingsBank').disabled, false);
  assert.equal(doc.getElementById('paymentSettingsPhone').disabled, false);
  assert.equal(doc.getElementById('btnSavePaymentSettings').disabled, false);
  assert.equal(doc.getElementById('paymentSettingsPhone').value, '+7 999 555-44-33');
  assert.equal(doc.getElementById('paymentSettingsRecipientFirstName').value, 'Дмитрий');
  assert.equal(doc.getElementById('paymentSettingsRecipientLastInitial').value, 'Д');
  assert.equal(doc.getElementById('paymentSettingsErrorBanner').classList.contains('hidden'), true);
  assert.equal(doc.getElementById('paymentSettingsFormStatus').textContent, '');
});

test('strict schema guard: partial 200 OK response (missing fields) prevents submit with zero POST calls', async () => {
  const doc = createMockAdminDoc();
  global.document = doc;
  global.Telegram = { WebApp: { initData: 'admin-init-data' } };
  global.GhostLinkV3 = {
    adminMockSession: { isAdmin: () => true, assertAdmin: () => true },
  };
  global.window = {
    document: doc,
    Telegram: { WebApp: { initData: 'admin-init-data' } },
    GhostLinkV3: global.GhostLinkV3,
  };

  let postCallsCount = 0;
  let toastMsg = '';

  const mockFetch = async (url, options) => {
    if (options?.method === 'POST' || url.includes('/api/admin/payment/settings')) {
      postCallsCount += 1;
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    // Partial GET response missing recipient and bank
    return {
      ok: true,
      status: 200,
      json: async () => ({
        phone: '+7 985 771-91-39',
        // bank is missing
        // recipient is missing
      }),
    };
  };

  initAdminPaymentSettingsModule({
    isAdmin: () => true,
    fetch: mockFetch,
    apiBase: 'https://api.test.ru',
    showToast: (msg) => { toastMsg = msg; },
    profileSubscription: { getToken: () => 'token-admin-func' },
    openOverlay: () => {},
  });

  const openBtn = doc.getElementById('btnOpenPaymentSettings');
  await openBtn.click();

  // Form inputs must remain disabled due to incomplete schema
  assert.equal(doc.getElementById('paymentSettingsPhone').disabled, true);
  assert.equal(doc.getElementById('btnSavePaymentSettings').disabled, true);
  assert.equal(doc.getElementById('paymentSettingsErrorBanner').classList.contains('hidden'), false);

  // Attempt to submit form
  const form = doc.getElementById('paymentSettingsForm');
  await form.dispatchEvent({ type: 'submit', preventDefault: () => {} });

  // Verify 0 POST network calls were made and toast was shown
  assert.equal(postCallsCount, 0, 'Zero POST requests must be dispatched when settings are not loaded');
  assert.equal(toastMsg, 'Реквизиты не загружены. Повторите загрузку.');
});



