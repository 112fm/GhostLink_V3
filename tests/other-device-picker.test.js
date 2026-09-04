const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const html = readFileSync(join(root, 'src/templates/pages/devices.html'), 'utf8');
const source = readFileSync(join(root, 'src/modules/devices.js'), 'utf8');

test('other-device page has clean platform picker and no key field or legacy list', () => {
  const picker = html.match(/<section id="page-other-device"[\s\S]*?<\/section>/);

  assert.ok(picker, 'other-device page must exist');
  assert.match(picker[0], /class="devices-grid" id="other-devices-grid"/);
  assert.match(picker[0], /data-platform="ios"/);
  assert.match(picker[0], /data-platform="android"/);
  assert.match(picker[0], /data-platform="macos"/);
  assert.match(picker[0], /data-platform="windows"/);
  assert.match(picker[0], /data-platform="tv"/);
  assert.match(picker[0], /data-platform="linux"/);
  assert.match(picker[0], /Выберите платформу/);
  assert.match(picker[0], /Выберите систему устройства, которое хотите подключить/);
  assert.match(picker[0], /class="other-platforms-section"/);
  assert.doesNotMatch(picker[0], /class="devices-section"/);
  assert.doesNotMatch(picker[0], /id="other-device-picker-list"/);
  assert.doesNotMatch(picker[0], /id="other-device-picker-status"/);
  assert.doesNotMatch(picker[0], /id="other-device-key-field"/);
  assert.doesNotMatch(picker[0], /other-device-picker-section/);
});

test('platform card selection configures new-other-device and opens app choice', () => {
  assert.match(source, /document\.querySelectorAll\('\.platform-card'\)\.forEach/);
  assert.match(source, /setupFlowMode = 'new-other-device'/);
  assert.match(source, /autoSelectDefaultAppForCurrentPlatform\(platform\)/);
  assert.match(source, /openOverlay\(pageAppSelect\)/);
});

test('setup routes another device to the picker and app choice cannot create a device or consume a slot', () => {
  const setupHandler = source.match(/setupContinueBtn\.addEventListener\('click',[\s\S]*?\n}\);/);
  const appChoice = source.slice(
    source.indexOf('function selectAppChoice(app)'),
    source.indexOf('function autoSelectDefaultAppForCurrentPlatform'),
  );

  assert.ok(setupHandler, 'setup continue handler must exist');
  assert.match(setupHandler[0], /openOtherDevicePicker\(\)/);
  assert.doesNotMatch(setupHandler[0], /startDeviceOperation|createDevice|addOperationDevice/);
  assert.doesNotMatch(appChoice, /startDeviceOperation|createDevice|addOperationDevice/);
});

test('openOtherDevicePicker opens page-other-device and selecting a platform routes to app choice without premature creation', async () => {
  const elements = new Map();
  const overlays = [];
  let createCalls = 0;

  function createElement(id = '', className = '') {
    const listeners = new Map();
    const children = [];
    return {
      id,
      className,
      children,
      dataset: {},
      style: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      append: (...items) => children.push(...items),
      appendChild: (item) => children.push(item),
      replaceChildren: (...items) => { children.splice(0, children.length, ...items); },
      addEventListener: (name, handler) => listeners.set(name, handler),
      click: () => listeners.get('click')?.(),
      querySelector: () => null,
      querySelectorAll: () => [],
      setAttribute: () => {},
      getAttribute: () => null,
      textContent: '',
    };
  }

  const platformCards = [
    createElement('', 'platform-card'),
  ];
  platformCards[0].dataset.platform = 'windows';

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
      if (selector === '.platform-card') return platformCards;
      return [];
    },
    addEventListener: () => {},
  };

  global.document = documentMock;
  global.navigator = { userAgent: 'iPhone' };
  global.window = { document: documentMock, GhostLinkV3: {}, Telegram: { WebApp: { platform: 'ios' } } };
  delete require.cache[require.resolve(join(root, 'src/modules/devices.js'))];
  require(join(root, 'src/modules/devices.js'));

  global.window.GhostLinkV3.initDevicesModule({
    showToast: () => {},
    copyText: async () => true,
    openOverlay: (page) => overlays.push(page?.id || page),
    closeOverlay: () => {},
    returnToHome: () => {},
    deviceList: {
      fetchList: async () => ({ devices: [] }),
    },
    deviceOperations: { createDevice: async () => { createCalls += 1; return {}; } },
  });

  const devices = global.window.GhostLinkV3.devices;
  await devices.openOtherDevicePicker();
  assert.deepEqual(overlays, ['page-other-device']);

  platformCards[0].click();
  assert.deepEqual(overlays, ['page-other-device', 'page-app-select']);
  assert.equal(createCalls, 0);
  assert.equal(devices.getSetupFlowMode(), 'new-other-device');
  assert.equal(devices.getPendingNewDevice()?.platform, 'windows');
});

test('device runtime has no mock-success path and creates canonical UUIDv4 request ids', () => {
  const source = require('node:fs').readFileSync(join(root, 'src/modules/devices.js'), 'utf8');
  assert.doesNotMatch(source, /mock:\/\/|Макет устройства готов|addOperationDevice/);
  assert.doesNotMatch(source, /Math\.random/);
  assert.match(source, /selectedSetupDeviceId = result\.device\.id/);
  assert.match(source, /crypto\.getRandomValues/);

  global.window.crypto = { getRandomValues: (bytes) => bytes.fill(7) };
  const requestId = global.window.GhostLinkV3.devices.createRequestId();
  assert.match(requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('selected device URLs pass one strict validator and unsafe values stay unavailable', () => {
  const devices = global.window.GhostLinkV3.devices;
  devices.selectDeviceForSetup({
    id: 'safe-device',
    url: 'https://api.112prd.ru:2053/sub/device-karing',
    url_incy: 'https://api.112prd.ru:2053/sub/device-incy?compat=incy',
  });
  assert.equal(devices.getSubscriptionUrl('karing'), 'https://api.112prd.ru:2053/sub/device-karing');
  assert.equal(devices.getSubscriptionUrl('incy'), 'https://api.112prd.ru:2053/sub/device-incy?compat=incy');

  for (const value of [
    'not-a-url',
    'https://evil.example/sub/foreign',
    'https://api.112prd.ru/api/session?access_token=secret',
    'https://api.112prd.ru:2053/sub/placeholder',
    'itms-apps://apps.apple.com/app/karing/id6472431552',
  ]) {
    devices.selectDeviceForSetup({ id: 'unsafe-device', url: value, url_incy: value });
    assert.equal(devices.getSubscriptionUrl('karing'), '', value);
    assert.equal(devices.getSubscriptionUrl('incy'), '', value);
  }
});
