const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const {
  initSubscriptionModule,
  formatBankName,
  isValidPayerName,
  getTariffPrice,
  isValidPrice,
} = require(path.join(root, 'src', 'modules', 'subscription.js'));
const { createRealBlock1Adapter } = require(path.join(root, 'src', 'api', 'real-block1-adapter.js'));

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

  const mockTariffsSnapshot = {
    tariffs: {
      period_prices: {
        1: { 2: { price: 150 }, 3: { price: 350 }, 4: { price: 450 }, 5: { price: 500 } },
        2: { 2: { price: 290 }, 3: { price: 630 }, 4: { price: 810 }, 5: { price: 900 } },
        3: { 2: { price: 430 }, 3: { price: 840 }, 4: { price: 1080 }, 5: { price: 1200 } },
      },
    },
  };

  initSubscriptionModule({
    fetch: mockFetch,
    apiBase: 'https://api.test.ru',
    showToast: (msg) => { toastMsg = msg; },
    profileSubscription: {
      getToken: () => 'token-456',
      getSnapshot: () => mockTariffsSnapshot,
      getCachedProfile: () => mockTariffsSnapshot,
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

    const mockTariffsSnapshot = {
      tariffs: {
        period_prices: {
          1: { 2: { price: 150 } },
        },
      },
    };

    initSubscriptionModule({
      fetch: mockFetch,
      showToast: (msg) => { toastMsg = msg; },
      profileSubscription: {
        getSnapshot: () => mockTariffsSnapshot,
        getCachedProfile: () => mockTariffsSnapshot,
      },
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

test('btnPay click opens checkout overlay and calculates dynamic price correctly without ReferenceError', async () => {
  const doc = createMockDocument();
  global.document = doc;
  global.Telegram = { WebApp: { initData: '' } };
  global.window = {
    document: doc,
    GhostLinkPaymentConfig: { banks: {}, get: () => ({}), set: () => {}, reset: () => {} },
    Telegram: { WebApp: { initData: '' } },
    GhostLinkV3: {},
  };

  let openedOverlay = null;
  const mockProfileSubscription = {
    getSnapshot: () => ({
      tariffs: {
        period_prices: {
          1: { 2: { price: 150 }, 3: { price: 350 }, 4: { price: 450 }, 5: { price: 500 } },
          2: { 2: { price: 290 }, 3: { price: 630 }, 4: { price: 810 }, 5: { price: 900 } },
          3: { 2: { price: 430 }, 3: { price: 840 }, 4: { price: 1080 }, 5: { price: 1200 } },
        },
      },
    }),
  };

  initSubscriptionModule({
    openOverlay: (overlay) => { openedOverlay = overlay; },
    profileSubscription: mockProfileSubscription,
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
  });

  const btnPay = doc.getElementById('btn-pay');
  assert.ok(btnPay, 'btn-pay element must exist');

  await btnPay.click();

  assert.equal(openedOverlay?.id, 'page-checkout');
  assert.equal(doc.getElementById('checkout-target-amount').textContent, '150 ₽');
  assert.equal(doc.getElementById('checkout-target-plan').textContent, 'Solo Ghost');
  assert.equal(doc.getElementById('checkout-form-view').style.display, 'flex');
});

test('getTariffPrice strictly returns null when tariffs are absent (Strict API Policy)', () => {
  assert.equal(getTariffPrice(2, 1, null), null);
  assert.equal(getTariffPrice(2, 1, {}), null);
  assert.equal(getTariffPrice(2, 1, { tariffs: null }), null);
  assert.equal(getTariffPrice(3, 2, { tariffs: { period_prices: {} } }), null);
});

test('isValidPrice strictly validates positive whole numbers and rejects invalid types', () => {
  assert.equal(isValidPrice(150), true);
  assert.equal(isValidPrice("350"), true);
  assert.equal(isValidPrice(1), true);

  assert.equal(isValidPrice("abc"), false);
  assert.equal(isValidPrice(0), false);
  assert.equal(isValidPrice(-100), false);
  assert.equal(isValidPrice(null), false);
  assert.equal(isValidPrice(undefined), false);
  assert.equal(isValidPrice(NaN), false);
  assert.equal(isValidPrice(Infinity), false);
  assert.equal(isValidPrice(-Infinity), false);
  assert.equal(isValidPrice(true), false);
  assert.equal(isValidPrice(false), false);
  assert.equal(isValidPrice(150.5), false);
  assert.equal(isValidPrice(""), false);
  assert.equal(isValidPrice({}), false);
});

test('getTariffPrice rejects invalid price types in period_prices and disables btnPay', async () => {
  const malformedSnapshot = {
    tariffs: {
      period_prices: {
        1: { 2: { price: "invalid_string" }, 3: { price: -50 } },
        2: { 2: { price: null }, 3: { price: 0 } },
      },
    },
  };

  assert.equal(getTariffPrice(2, 1, malformedSnapshot), null);
  assert.equal(getTariffPrice(3, 1, malformedSnapshot), null);
  assert.equal(getTariffPrice(2, 2, malformedSnapshot), null);
  assert.equal(getTariffPrice(3, 2, malformedSnapshot), null);

  const doc = createMockDocument();
  global.document = doc;
  global.Telegram = { WebApp: { initData: '' } };
  global.window = {
    document: doc,
    GhostLinkPaymentConfig: { banks: {}, get: () => ({}), set: () => {}, reset: () => {} },
    Telegram: { WebApp: { initData: '' } },
    GhostLinkV3: {},
  };

  initSubscriptionModule({
    profileSubscription: {
      getSnapshot: () => malformedSnapshot,
      getCachedProfile: () => malformedSnapshot,
    },
  });

  const btnPay = doc.getElementById('btn-pay');
  assert.equal(btnPay.disabled, true);
  assert.equal(doc.getElementById('pay-total').textContent, 'Загрузка тарифов…');
  assert.equal(doc.getElementById('price-card-1').textContent, '— ₽');
});

test('asynchronous arrival of tariffs triggers reactive UI recalculation and unlocks btnPay', async () => {
  const doc = createMockDocument();
  global.document = doc;
  global.Telegram = { WebApp: { initData: '' } };
  global.window = {
    document: doc,
    GhostLinkPaymentConfig: { banks: {}, get: () => ({}), set: () => {}, reset: () => {} },
    Telegram: { WebApp: { initData: '' } },
    GhostLinkV3: {},
  };

  let currentSnapshot = { tariffs: null };
  const subscribers = [];

  const mockProfileSub = {
    getSnapshot: () => currentSnapshot,
    getCachedProfile: () => currentSnapshot,
    subscribe: (cb) => { subscribers.push(cb); },
  };

  initSubscriptionModule({
    profileSubscription: mockProfileSub,
  });

  const btnPay = doc.getElementById('btn-pay');
  // Initially disabled before tariffs arrive
  assert.equal(btnPay.disabled, true);
  assert.equal(doc.getElementById('pay-total').textContent, 'Загрузка тарифов…');
  assert.equal(doc.getElementById('price-card-1').textContent, '— ₽');

  // Tariffs arrive asynchronously from backend
  currentSnapshot = {
    tariffs: {
      period_prices: {
        1: { 2: { price: 150 }, 3: { price: 350 }, 4: { price: 450 }, 5: { price: 500 } },
        2: { 2: { price: 290 }, 3: { price: 630 }, 4: { price: 810 }, 5: { price: 900 } },
        3: { 2: { price: 430 }, 3: { price: 840 }, 4: { price: 1080 }, 5: { price: 1200 } },
      },
    },
  };

  // Notify subscribers
  subscribers.forEach((cb) => cb(currentSnapshot));

  // UI automatically recalculated and unlocked
  assert.equal(btnPay.disabled, false);
  assert.equal(doc.getElementById('pay-total').textContent, '150 ₽');
  assert.equal(doc.getElementById('price-card-1').textContent, '150 ₽');
  assert.equal(doc.getElementById('price-card-2').textContent, '290 ₽');
  assert.equal(doc.getElementById('price-card-3').textContent, '430 ₽');
});

test('full production tariff matrix validates correctly (Solo 2 dev; Flex 3, 4, 5 dev across 1, 2, 3 months)', () => {
  const prodSnapshot = {
    tariffs: {
      period_prices: {
        1: { 2: { price: 150 }, 3: { price: 350 }, 4: { price: 450 }, 5: { price: 500 } },
        2: { 2: { price: 290 }, 3: { price: 630 }, 4: { price: 810 }, 5: { price: 900 } },
        3: { 2: { price: 430 }, 3: { price: 840 }, 4: { price: 1080 }, 5: { price: 1200 } },
      },
    },
  };

  // Solo Ghost (2 devices)
  assert.equal(getTariffPrice(2, 1, prodSnapshot), 150);
  assert.equal(getTariffPrice(2, 2, prodSnapshot), 290);
  assert.equal(getTariffPrice(2, 3, prodSnapshot), 430);

  // Flex Squad 3 devices
  assert.equal(getTariffPrice(3, 1, prodSnapshot), 350);
  assert.equal(getTariffPrice(3, 2, prodSnapshot), 630);
  assert.equal(getTariffPrice(3, 3, prodSnapshot), 840);

  // Flex Squad 4 devices
  assert.equal(getTariffPrice(4, 1, prodSnapshot), 450);
  assert.equal(getTariffPrice(4, 2, prodSnapshot), 810);
  assert.equal(getTariffPrice(4, 3, prodSnapshot), 1080);

  // Flex Squad 5 devices
  assert.equal(getTariffPrice(5, 1, prodSnapshot), 500);
  assert.equal(getTariffPrice(5, 2, prodSnapshot), 900);
  assert.equal(getTariffPrice(5, 3, prodSnapshot), 1200);
});

test('full integration: real Block 1 adapter reactive subscription auto-refreshes subscription UI when tariffs arrive', async () => {
  const doc = createMockDocument();
  global.document = doc;
  global.Telegram = { WebApp: { initData: 'telegram-init-data' } };
  global.window = {
    document: doc,
    GhostLinkPaymentConfig: { banks: {}, get: () => ({}), set: () => {}, reset: () => {} },
    Telegram: { WebApp: { initData: 'telegram-init-data' } },
    GhostLinkV3: {},
  };

  let resolveTariffs;
  const tariffsPromise = new Promise((resolve) => {
    resolveTariffs = resolve;
  });

  const mockResponse = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  });

  const adapter = createRealBlock1Adapter({
    apiBase: 'https://api.example.test',
    getInitData: () => 'telegram-init-data',
    fetch: async (url) => {
      if (url.endsWith('/api/miniapp/session')) {
        return mockResponse(200, { session_token: 'secret-token' });
      }
      if (url.endsWith('/api/user')) {
        return mockResponse(200, {
          user: { id: '123', name: 'Real User' },
          subscription: { active: true, status: 'active', days_left: 30 },
          tariff_name: 'Solo Ghost',
          device_limit: 2,
          connected_devices: 1,
        });
      }
      if (url.endsWith('/api/tariffs')) {
        const tariffsData = await tariffsPromise;
        return mockResponse(200, tariffsData);
      }
      return mockResponse(200, {});
    },
  });

  initSubscriptionModule({
    profileSubscription: adapter,
  });

  const btnPay = doc.getElementById('btn-pay');
  assert.ok(btnPay, 'btn-pay must exist');

  // Initial load of profile (tariffs not yet resolved)
  await adapter.fetchProfileSubscription();

  // Button must be disabled and loading text shown
  assert.equal(btnPay.disabled, true);
  assert.equal(doc.getElementById('pay-total').textContent, 'Загрузка тарифов…');
  assert.equal(doc.getElementById('price-card-1').textContent, '— ₽');

  // Asynchronously resolve tariffs from server
  resolveTariffs({
    period_prices: {
      1: { 2: { price: 150 }, 3: { price: 350 }, 4: { price: 450 }, 5: { price: 500 } },
      2: { 2: { price: 290 }, 3: { price: 630 }, 4: { price: 810 }, 5: { price: 900 } },
      3: { 2: { price: 430 }, 3: { price: 840 }, 4: { price: 1080 }, 5: { price: 1200 } },
    },
  });

  // Allow microtasks to resolve background tariffs stage and notify listeners
  await new Promise((r) => setTimeout(r, 20));

  // Reactive subscription must have automatically updated UI and unlocked btnPay
  assert.equal(btnPay.disabled, false);
  assert.equal(doc.getElementById('pay-total').textContent, '150 ₽');
  assert.equal(doc.getElementById('price-card-1').textContent, '150 ₽');
  assert.equal(doc.getElementById('price-card-2').textContent, '290 ₽');
  assert.equal(doc.getElementById('price-card-3').textContent, '430 ₽');
});





