const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const html = readFileSync(join(root, 'src/templates/pages/devices.html'), 'utf8');
const source = readFileSync(join(root, 'src/modules/devices.js'), 'utf8');

test('other-device page has a dynamic device picker and hides the legacy static cards', () => {
  const picker = html.match(/<section id="page-other-device"[\s\S]*?<\/section>/);

  assert.ok(picker, 'other-device page must exist');
  assert.match(picker[0], /id="other-device-picker-list"/);
  assert.match(picker[0], /id="other-device-picker-status"/);
  assert.match(picker[0], /class="devices-grid" hidden aria-hidden="true"/);
  assert.match(picker[0], /key-box-container"[^>]*hidden aria-hidden="true"[\s\S]*?id="other-device-key-field"/);
});

test('picker takes only the current device-list entries and passes their UUID to app choice', () => {
  assert.match(source, /async function openOtherDevicePicker\(\)[\s\S]*?deviceList\?\.fetchList\?\.\(\)/);
  assert.match(source, /function renderOtherDevicePicker\(devices\)[\s\S]*?card\.dataset\.deviceUuid = device\.id/);
  assert.match(source, /card\.addEventListener\('click', \(\) => selectDeviceForSetup\(device\)\)/);
  assert.match(source, /function selectDeviceForSetup\(device\)[\s\S]*?selectedSetupDeviceId = device\.id[\s\S]*?openOverlay\(pageAppSelect\)/);
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

test('picker renders the adapter device UUID and app choice does not start a device operation', async () => {
  const elements = new Map();
  const overlays = [];
  let createCalls = 0;

  function createElement(id = '') {
    const listeners = new Map();
    const children = [];
    return {
      id,
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
  global.window = { document: documentMock, GhostLinkV3: {}, Telegram: { WebApp: { platform: 'ios' } } };
  delete require.cache[require.resolve(join(root, 'src/modules/devices.js'))];
  require(join(root, 'src/modules/devices.js'));

  global.window.GhostLinkV3.initDevicesModule({
    showToast: () => {},
    copyText: async () => true,
    openOverlay: (page) => overlays.push(page.id),
    closeOverlay: () => {},
    returnToHome: () => {},
    deviceList: {
      fetchList: async () => ({ devices: [{ id: 'uuid-from-adapter', name: 'MacBook', app: 'Не выбрано', platform: 'laptop' }] }),
    },
    deviceOperations: { createDevice: async () => { createCalls += 1; return {}; } },
  });

  const devices = global.window.GhostLinkV3.devices;
  await devices.openOtherDevicePicker();
  const picker = documentMock.getElementById('other-device-picker-list');
  assert.equal(picker.children.length, 1);
  assert.equal(picker.children[0].dataset.deviceUuid, 'uuid-from-adapter');

  picker.children[0].click();
  assert.equal(devices.getSelectedSetupDeviceId(), 'uuid-from-adapter');
  assert.deepEqual(overlays, ['page-other-device', 'page-app-select']);
  assert.equal(createCalls, 0);
});
