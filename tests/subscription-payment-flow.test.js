const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const {
  initSubscriptionModule,
  formatBankName,
  isValidPayerName,
  PRICE_TABLE,
} = require(path.join(root, 'src', 'modules', 'subscription.js'));

function createMockElement(id = '', tagName = 'div') {
  const listeners = new Map();
  const classes = new Set();
  const dataset = {};
  const attributes = new Map();
  let value = '';
  let textContent = '';
  let style = {};

  return {
    id,
    tagName: tagName.toUpperCase(),
    dataset,
    style,
    disabled: false,
    checked: false,
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
    setAttribute: (name, val) => attributes.set(name, String(val)),
    getAttribute: (name) => attributes.get(name) ?? null,
    removeAttribute: (name) => attributes.delete(name),
    focus: () => {},
    click: async function() {
      await this.dispatchEvent({ type: 'click', preventDefault: () => {} });
    },
  };
}

function createMockDocument() {
  const elements = new Map();

  function getOrCreate(id, tagName = 'div') {
    if (!elements.has(id)) {
      elements.set(id, createMockElement(id, tagName));
    }
    return elements.get(id);
  }

  // Setup basic form structure elements
  const ids = [
    'btn-extend-back', 'page-extend', 'btn-pay', 'page-checkout', 'btn-checkout-back',
    'checkout-form-view', 'checkout-pending-view', 'checkout-approved-view', 'checkout-rejected-view',
    'btn-pending-home', 'btn-approved-home', 'btn-copy-phone', 'btn-submit-payment', 'btn-retry-payment',
    'payer-name-input', 'req-bank-name', 'req-phone-num', 'req-recipient-name',
    'pending-bank-val', 'pending-payer-val', 'pending-time-val', 'pending-plan-val', 'pending-amount-val',
    'approved-amount-val', 'approved-plan-val', 'approved-dev-val',
    'rejected-plan-val', 'rejected-amount-val', 'rejected-payer-val',
    'confirmation-name-dot', 'confirmation-name-text', 'confirmation-bank-name',
    'checkout-target-plan', 'checkout-target-period', 'checkout-target-dev', 'checkout-target-amount',
    'flex-dev-count', 'btn-dev-minus', 'btn-dev-plus',
    'price-card-1', 'price-card-2', 'price-card-3',
    'subprice-card-1', 'subprice-card-2', 'subprice-card-3',
    'devices-desc', 'icon-phone', 'icon-laptop', 'icon-tv',
    'summary-details', 'summary-day-cost', 'pay-total', 'pay-old', 'pay-discount',
  ];

  ids.forEach(id => getOrCreate(id));

  // Radios
  const tariffRadio = createMockElement('', 'input');
  tariffRadio.name = 'tariff-period';
  tariffRadio.value = '1';
  tariffRadio.checked = true;

  const deviceRadioSolo = createMockElement('', 'input');
  deviceRadioSolo.name = 'device-type';
  deviceRadioSolo.value = 'solo';
  deviceRadioSolo.checked = true;

  return {
    elements,
    getElementById: (id) => elements.get(id) || null,
    querySelector: (selector) => {
      if (selector === '.bento-extend') return elements.get('bento-extend') || createMockElement('bento-extend');
      if (selector === 'input[name="tariff-period"]:checked') return tariffRadio;
      if (selector === 'input[name="device-type"]:checked') return deviceRadioSolo;
      if (selector.startsWith('#')) return elements.get(selector.slice(1)) || null;
      return null;
    },
    querySelectorAll: (selector) => {
      if (selector === 'input[name="tariff-period"]') return [tariffRadio];
      if (selector === 'input[name="device-type"]') return [deviceRadioSolo];
      if (selector.includes('pagination') || selector.includes('slide')) return [];
      return [];
    },
  };
}

test('formatBankName normalizes known aliases and preserves human strings', () => {
  assert.equal(formatBankName('alfa'), 'Альфа-Банк');
  assert.equal(formatBankName('alfabank'), 'Альфа-Банк');
  assert.equal(formatBankName('tbank'), 'Т-Банк');
  assert.equal(formatBankName('tinkoff'), 'Т-Банк');
  assert.equal(formatBankName('sber'), 'Сбербанк');
  assert.equal(formatBankName('sberbank'), 'Сбербанк');
  assert.equal(formatBankName('ozon'), 'Озон-банк');
  assert.equal(formatBankName('ozonbank'), 'Озон-банк');
  assert.equal(formatBankName('vtb'), 'ВТБ');
  assert.equal(formatBankName('Сбербанк'), 'Сбербанк');
  assert.equal(formatBankName(''), 'Т-Банк');
});

test('isValidPayerName accepts full names and initials with dots', () => {
  assert.equal(isValidPayerName('Иван Иванов'), true);
  assert.equal(isValidPayerName('Иван И.'), true);
  assert.equal(isValidPayerName('Иван И'), true);
  assert.equal(isValidPayerName('Анна-Мария Смирнова'), true);
  assert.equal(isValidPayerName('Arseny A.'), true);

  // Invalid: empty, single word, digits only
  assert.equal(isValidPayerName(''), false);
  assert.equal(isValidPayerName('Иван'), false);
  assert.equal(isValidPayerName('12345'), false);
  assert.equal(isValidPayerName('А'), false);
});

test('GET /api/payment/settings updates checkout requisites when loaded', async () => {
  const doc = createMockDocument();
  global.document = doc;
  global.Telegram = { WebApp: { initData: 'mock-init-data' } };
  global.window = {
    document: doc,
    GhostLinkPaymentConfig: {
      banks: { tbank: 'Т-Банк', alfabank: 'Альфа-Банк' },
      get: () => ({ bankKey: 'tbank', phone: '+7 000', recipient: 'Тест' }),
      set: (d) => d,
      reset: () => ({ bankKey: 'tbank', phone: '+7 000', recipient: 'Тест' }),
    },
    Telegram: { WebApp: { initData: 'mock-init-data' } },
  };

  let fetchedUrl = '';
  let fetchedHeaders = {};

  const mockFetch = async (url, options) => {
    fetchedUrl = url;
    fetchedHeaders = options.headers;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        phone: '+79857719139',
        bank: 'alfa',
        recipient: 'Арсений А.',
      }),
    };
  };

  initSubscriptionModule({
    fetch: mockFetch,
    apiBase: 'https://api.test.ru',
    profileSubscription: {
      getToken: () => 'test-token-123',
    },
  });

  // Give async loadPaymentSettings time to resolve
  await new Promise(r => setTimeout(r, 20));

  assert.equal(fetchedUrl, 'https://api.test.ru/api/payment/settings');
  assert.equal(fetchedHeaders['X-PWA-Token'], 'test-token-123');
  assert.equal(fetchedHeaders['X-Telegram-InitData'], 'mock-init-data');

  assert.equal(doc.getElementById('req-bank-name').textContent, 'Альфа-Банк');
  assert.equal(doc.getElementById('confirmation-bank-name').textContent, 'Альфа-Банк');
  assert.equal(doc.getElementById('req-phone-num').textContent, '+79857719139');
  assert.equal(doc.getElementById('req-recipient-name').textContent, 'Получатель: Арсений А.');
});

test('POST /api/payment/report submits valid payment and switches to pending view', async () => {
  const doc = createMockDocument();
  global.document = doc;
  global.Telegram = { WebApp: { initData: 'mock-init-data' } };
  global.window = {
    document: doc,
    GhostLinkPaymentConfig: {
      banks: { tbank: 'Т-Банк' },
      get: () => ({ bankKey: 'tbank', phone: '+7 000', recipient: 'Тест' }),
      set: (d) => d,
      reset: () => ({}),
    },
    Telegram: { WebApp: { initData: 'mock-init-data' } },
  };

  let postedUrl = '';
  let postedBody = null;
  let postedHeaders = null;
  let toastMsg = '';

  const mockFetch = async (url, options) => {
    if (url.includes('/api/payment/settings')) {
      return { ok: true, status: 200, json: async () => ({ phone: '+7 999', bank: 'tbank', recipient: 'Иван' }) };
    }
    postedUrl = url;
    postedHeaders = options.headers;
    postedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, status: 'pending', payment_request_id: postedBody.request_id }),
    };
  };

  initSubscriptionModule({
    fetch: mockFetch,
    apiBase: 'https://api.test.ru',
    showToast: (msg) => { toastMsg = msg; },
    profileSubscription: {
      getToken: () => 'token-456',
    },
  });

  const payerInput = doc.getElementById('payer-name-input');
  payerInput.value = 'Сергей Петров';

  const btnSubmit = doc.getElementById('btn-submit-payment');
  await btnSubmit.click();

  assert.equal(postedUrl, 'https://api.test.ru/api/payment/report');
  assert.equal(postedBody.sender_name, 'Сергей Петров');
  assert.equal(postedBody.amount, 150);
  assert.equal(postedBody.target_device_limit, 2);
  assert.equal(postedBody.period_months, 1);
  assert.equal(postedBody.payment_label, 'Solo Ghost');

  // Verify Canonical UUID v4
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.match(postedBody.request_id, uuidV4Regex);
  assert.equal(postedHeaders['X-Request-ID'], postedBody.request_id);

  // Verify pending view switch
  assert.equal(doc.getElementById('checkout-form-view').style.display, 'none');
  assert.equal(doc.getElementById('checkout-pending-view').style.display, 'flex');
  assert.equal(doc.getElementById('pending-payer-val').textContent, 'Сергей Петров');
  assert.equal(toastMsg, 'Заявка на оплату отправлена');
});

test('POST /api/payment/report validates invalid payer name without sending request', async () => {
  const doc = createMockDocument();
  global.document = doc;
  global.Telegram = { WebApp: { initData: '' } };
  global.window = {
    document: doc,
    GhostLinkPaymentConfig: { banks: {}, get: () => ({}), set: () => {}, reset: () => {} },
    Telegram: { WebApp: { initData: '' } },
  };

  let reportFetched = false;
  let toastMsg = '';

  initSubscriptionModule({
    fetch: async (url) => {
      if (url.includes('/api/payment/settings')) {
        return { ok: true, status: 200, json: async () => ({ phone: '+7 999 000-00-00', bank: 'tbank', recipient: 'Иван И.' }) };
      }
      if (url.includes('/api/payment/report')) {
        reportFetched = true;
      }
      return { ok: true, status: 200, json: async () => ({}) };
    },
    showToast: (msg) => { toastMsg = msg; },
  });

  const payerInput = doc.getElementById('payer-name-input');
  payerInput.value = 'Иван'; // invalid single name

  const btnSubmit = doc.getElementById('btn-submit-payment');
  await btnSubmit.click();

  assert.equal(reportFetched, false);
  assert.match(toastMsg, /Укажи имя и фамилию/);
  assert.ok(payerInput.classList.contains('error'));
});

test('POST /api/payment/report handles 400, 401, 500 server errors and network failure', async () => {
  const doc = createMockDocument();
  global.document = doc;
  global.window = {
    document: doc,
    GhostLinkPaymentConfig: { banks: {}, get: () => ({}), set: () => {}, reset: () => {} },
    Telegram: { WebApp: { initData: '' } },
  };

  const testCases = [
    {
      status: 400,
      json: { detail: 'Сумма не соответствует выбранному тарифу' },
      expectedToast: /Сумма не соответствует/i,
    },
    {
      status: 401,
      json: { detail: 'Unauthorized' },
      expectedToast: /Сессия истекла|Unauthorized/i,
    },
    {
      status: 500,
      json: { detail: 'Internal server error' },
      expectedToast: /Сервер временно недоступен/i,
    },
  ];

  for (const tc of testCases) {
    let toastMsg = '';
    const mockFetch = async (url) => {
      if (url.includes('/api/payment/settings')) {
        return { ok: true, status: 200, json: async () => ({ phone: '+7 999 000-00-00', bank: 'tbank', recipient: 'Иван И.' }) };
      }
      return {
        ok: false,
        status: tc.status,
        json: async () => tc.json,
      };
    };

    initSubscriptionModule({
      fetch: mockFetch,
      showToast: (msg) => { toastMsg = msg; },
    });

    const payerInput = doc.getElementById('payer-name-input');
    payerInput.value = 'Николай Сидоров';

    const btnSubmit = doc.getElementById('btn-submit-payment');
    await btnSubmit.click();

    assert.match(toastMsg, tc.expectedToast);
    assert.equal(doc.getElementById('checkout-form-view').style.display, 'flex');
    assert.equal(btnSubmit.disabled, false);
  }
});

test('GET /api/payment/settings failure displays error state without mock values', async () => {
  const doc = createMockDocument();
  global.document = doc;
  global.Telegram = { WebApp: { initData: '' } };
  global.window = {
    document: doc,
    GhostLinkPaymentConfig: { banks: {}, get: () => ({}), set: () => {}, reset: () => {} },
    Telegram: { WebApp: { initData: '' } },
  };

  const mockFetch = async (url) => {
    if (url.includes('/api/payment/settings')) {
      return { ok: false, status: 500 };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };

  initSubscriptionModule({
    fetch: mockFetch,
  });

  await new Promise((r) => setTimeout(r, 20));

  assert.equal(doc.getElementById('req-phone-num').textContent, 'Реквизиты временно недоступны');
  assert.equal(doc.getElementById('req-bank-name').textContent, '⚠️ Ошибка связи');
  assert.equal(doc.getElementById('req-recipient-name').textContent, 'Нажмите здесь, чтобы повторить попытку');
});

