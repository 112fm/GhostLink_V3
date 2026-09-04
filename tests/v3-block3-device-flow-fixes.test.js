const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const { createRealDeviceAdapter } = require(join(root, 'src', 'api', 'real-device-adapter.js'));
const devicesHtml = readFileSync(join(root, 'src', 'templates', 'pages', 'devices.html'), 'utf8');
const devicesJs = readFileSync(join(root, 'src', 'modules', 'devices.js'), 'utf8');
const baseCss = readFileSync(join(root, 'src', 'css', 'base.css'), 'utf8');
const settingsCss = readFileSync(join(root, 'src', 'css', 'page-settings.css'), 'utf8');

function createMockResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

test('1. Scenario 1 (This device): does not create device until app selection and gets device-scoped URL', async () => {
  const elements = new Map();
  function createElement(id = '') {
    const listeners = new Map();
    const children = [];
    return {
      id,
      children,
      dataset: {},
      style: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
      append: (...items) => children.push(...items),
      replaceChildren: (...items) => { children.splice(0, children.length, ...items); },
      addEventListener: (name, handler) => listeners.set(name, handler),
      click: function() { listeners.get('click')?.(); this.onclick?.(); },
      querySelector: () => null,
      querySelectorAll: () => [],
      setAttribute: () => {},
      getAttribute: () => null,
      textContent: '',
    };
  }

  const documentMock = {
    readyState: 'complete',
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, createElement(id));
      return elements.get(id);
    },
    createElement: () => createElement(),
    createTextNode: (text) => ({ textContent: String(text) }),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  };

  global.document = documentMock;
  global.navigator = { userAgent: 'iPhone' };
  global.window = {
    document: documentMock,
    crypto: { randomUUID: () => 'test-req-123' },
    GhostLinkV3: { apiBase: 'https://api.112prd.ru' },
    Telegram: { WebApp: { platform: 'ios' } },
  };

  delete require.cache[require.resolve(join(root, 'src', 'modules', 'devices.js'))];
  require(join(root, 'src', 'modules', 'devices.js'));

  let createdDevices = [];
  global.window.GhostLinkV3.initDevicesModule({
    showToast: () => {},
    copyText: async () => true,
    openOverlay: () => {},
    closeOverlay: () => {},
    returnToHome: () => {},
    profileSubscription: {
      getApiBase: () => 'https://api.112prd.ru',
      getToken: () => 'auth-token-123',
    },
    deviceList: {
      fetchList: async () => ({
        devices: createdDevices,
        usedSlots: createdDevices.length,
        deviceLimit: 3,
        freeSlots: 3 - createdDevices.length,
      }),
    },
    deviceOperations: {
      createDevice: async (payload) => {
        const newDev = {
          id: 'dev-iphone-auto',
          name: payload.name,
          platform: payload.platform,
          url: 'https://api.112prd.ru:2053/s/tok-ios#GhostLink',
          url_incy: 'https://api.112prd.ru:2053/s/tok-ios?compat=incy#GhostLink',
          isCurrent: true,
        };
        createdDevices.push(newDev);
        return { status: 'succeeded', device: newDev };
      },
    },
  });

  const devices = global.window.GhostLinkV3.devices;

  // Before app choice: no device created yet
  assert.equal(createdDevices.length, 0);

  // User selects INCY and proceeds to key view
  devices.selectAppChoice('incy');
  await devices.proceedToKeyView();

  // Device is now created and device-scoped INCY URL is resolved
  assert.equal(createdDevices.length, 1);
  assert.equal(devices.getSelectedSetupDeviceId(), 'dev-iphone-auto');
  assert.equal(devices.getSubscriptionUrl('incy'), 'https://api.112prd.ru:2053/s/tok-ios?compat=incy#GhostLink');
  assert.equal(devices.getSubscriptionUrl('karing'), 'https://api.112prd.ru:2053/s/tok-ios#GhostLink');
});

test('2. Scenario 2 (Other device): new device deferred until app choice and added only after backend confirmation', async () => {
  const elements = new Map();
  function createElement(id = '') {
    const listeners = new Map();
    const children = [];
    return {
      id,
      children,
      dataset: {},
      style: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
      append: (...items) => children.push(...items),
      replaceChildren: (...items) => { children.splice(0, children.length, ...items); },
      addEventListener: (name, handler) => listeners.set(name, handler),
      click: function() { listeners.get('click')?.(); this.onclick?.(); },
      querySelector: () => null,
      querySelectorAll: () => [],
      setAttribute: () => {},
      getAttribute: () => null,
      textContent: '',
    };
  }

  const platformCard = createElement('', 'platform-card');
  platformCard.dataset.platform = 'windows';

  const documentMock = {
    readyState: 'complete',
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, createElement(id));
      return elements.get(id);
    },
    createElement: () => createElement(),
    createTextNode: (text) => ({ textContent: String(text) }),
    querySelector: () => null,
    querySelectorAll: (selector) => {
      if (selector === '.platform-card') return [platformCard];
      return [];
    },
    addEventListener: () => {},
  };

  global.document = documentMock;
  global.navigator = { userAgent: 'iPhone' };
  global.window = {
    document: documentMock,
    crypto: { randomUUID: () => 'test-req-other-456' },
    GhostLinkV3: { apiBase: 'https://api.112prd.ru' },
    Telegram: { WebApp: { platform: 'ios' } },
  };

  delete require.cache[require.resolve(join(root, 'src', 'modules', 'devices.js'))];
  require(join(root, 'src', 'modules', 'devices.js'));

  let createdDevices = [];
  global.window.GhostLinkV3.initDevicesModule({
    showToast: () => {},
    copyText: async () => true,
    openOverlay: () => {},
    closeOverlay: () => {},
    returnToHome: () => {},
    profileSubscription: {
      getApiBase: () => 'https://api.112prd.ru',
      getToken: () => 'auth-token-123',
    },
    deviceList: {
      fetchList: async () => ({
        devices: createdDevices,
        usedSlots: createdDevices.length,
        deviceLimit: 3,
        freeSlots: 3 - createdDevices.length,
      }),
    },
    deviceOperations: {
      createDevice: async (payload) => {
        const newDev = {
          id: 'dev-laptop-99',
          name: payload.name,
          platform: payload.platform,
          url: 'https://api.112prd.ru:2053/s/tok-laptop#GhostLink',
          url_incy: 'https://api.112prd.ru:2053/s/tok-laptop?compat=incy#GhostLink',
          isCurrent: false,
        };
        createdDevices.push(newDev);
        return { status: 'succeeded', device: newDev };
      },
    },
  });

  const devices = global.window.GhostLinkV3.devices;

  // Open other device picker
  await devices.openOtherDevicePicker();
  assert.equal(createdDevices.length, 0);

  // Click platform card on other device screen
  platformCard.click();

  // Mode is now new-other-device, pending device set, but backend create NOT called yet
  assert.equal(devices.getSetupFlowMode(), 'new-other-device');
  assert.equal(devices.getPendingNewDevice()?.name, 'Мой Windows');
  assert.equal(createdDevices.length, 0, 'Must not create key before app selection');

  // Choose Karing and proceed to key view
  devices.selectAppChoice('karing');
  await devices.proceedToKeyView();

  // Device created and confirmed by backend
  assert.equal(createdDevices.length, 1);
  assert.equal(createdDevices[0].id, 'dev-laptop-99');
  assert.equal(devices.getSelectedSetupDeviceId(), 'dev-laptop-99');
  assert.equal(devices.getSubscriptionUrl('karing'), 'https://api.112prd.ru:2053/s/tok-laptop#GhostLink');
});

test('3. INCY deep-link format and browser-free opening with lossless encoding', () => {
  // Verifies that btnAddToApp uses incy://import/ with encodeURIComponent
  assert.match(devicesJs, /const incyDeepLink = `incy:\/\/import\/\$\{encodeURIComponent\(subUrl\)\}`;/);
  // Verifies that window.location.href is used for incyDeepLink instead of openLink on https://
  assert.match(devicesJs, /window\.location\.href = incyDeepLink/);
  assert.doesNotMatch(devicesJs, /Telegram\.WebApp\.openLink\(subUrl\)/);

  // Test with a full production-like URL containing token, query parameters, and hash
  const fullSubUrl = 'https://api.112prd.ru:2053/s/test-token-xyz789?compat=incy&routing=true#GhostLink';
  const deepLink = `incy://import/${encodeURIComponent(fullSubUrl)}`;

  // Verifies scheme and prefix
  assert.ok(deepLink.startsWith('incy://import/'));
  // Verifies that characters like '#', '?', '&' are encoded safely in payload
  assert.doesNotMatch(deepLink.slice('incy://import/'.length), /[#?&]/);

  // Verifies lossless decoding
  const encodedPayload = deepLink.replace('incy://import/', '');
  const decodedUrl = decodeURIComponent(encodedPayload);
  assert.equal(decodedUrl, fullSubUrl, 'Decoded URL must exactly match the full original URL without loss');
});

test('4. Error mapping replaces partial_failure_restored with human-friendly message', async () => {
  const adapter = createRealDeviceAdapter({
    apiBase: 'https://api.112prd.ru',
    getToken: () => 'auth-token',
    fetch: async () => createMockResponse(200, {
      ok: false,
      request_id: 'req-err-1',
      status: 'failed',
      detail: 'partial_failure_restored',
    }),
  });

  const res = await adapter.getStatus('req-err-1');
  assert.equal(res.status, 'failed');
  assert.equal(res.message, 'Не удалось завершить операцию. Исходное состояние устройства восстановлено.');
});

test('5. Toast is viewport-fixed above overlays and device actions are 2 columns', () => {
  assert.match(baseCss, /\.toast\s*\{[\s\S]*position:\s*fixed;/);
  assert.match(baseCss, /\.toast\s*\{[\s\S]*z-index:\s*10000;/);
  assert.match(settingsCss, /\.device-card-actions\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
});
