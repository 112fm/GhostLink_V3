const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const { createRealDeviceAdapter } = require(join(root, 'src', 'api', 'real-device-adapter.js'));

function createMockResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

test('1. device/list returns real devices and maps per-device URLs and slot ratio', async () => {
  const calls = [];
  const adapter = createRealDeviceAdapter({
    apiBase: 'https://api.112prd.ru',
    getToken: () => 'valid-session-token',
    fetch: async (url, options) => {
      calls.push({ url, options });
      return createMockResponse(200, {
        ok: true,
        devices: [
          {
            id: 'uuid-phone-1',
            name: 'iPhone 15 Pro',
            device_type: 'phone',
            is_current: true,
            is_active: true,
            url: 'https://api.112prd.ru:2053/s/token-phone#GhostLink',
            url_incy: 'https://api.112prd.ru:2053/s/token-phone?compat=incy#GhostLink',
          },
          {
            id: 'uuid-mac-2',
            name: 'MacBook Air',
            device_type: 'laptop',
            is_current: false,
            is_active: true,
            url: 'https://api.112prd.ru:2053/s/token-mac#GhostLink',
            url_incy: 'https://api.112prd.ru:2053/s/token-mac?compat=incy#GhostLink',
          },
        ],
        connected_devices: 2,
        device_limit: 3,
        devices_ratio: '2/3',
        can_add: true,
      });
    },
  });

  const snapshot = await adapter.fetchList();
  assert.equal(calls[0].url, 'https://api.112prd.ru/api/device/list');
  assert.equal(calls[0].options.headers['X-PWA-Token'], 'valid-session-token');
  assert.equal(snapshot.devices.length, 2);
  assert.equal(snapshot.usedSlots, 2);
  assert.equal(snapshot.deviceLimit, 3);
  assert.equal(snapshot.freeSlots, 1);
  assert.equal(snapshot.canAdd, true);
  assert.equal(snapshot.devices[0].url, 'https://api.112prd.ru:2053/s/token-phone#GhostLink');
  assert.equal(snapshot.devices[0].url_incy, 'https://api.112prd.ru:2053/s/token-phone?compat=incy#GhostLink');
  assert.equal(snapshot.devices[1].url, 'https://api.112prd.ru:2053/s/token-mac#GhostLink');
  assert.equal(snapshot.devices[1].url_incy, 'https://api.112prd.ru:2053/s/token-mac?compat=incy#GhostLink');
});

test('2. selecting a device sets its own Karing and INCY URLs without consuming a slot or creating duplicate', () => {
  const elements = new Map();
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
  global.window = {
    document: documentMock,
    GhostLinkV3: { apiBase: 'https://api.112prd.ru' },
    Telegram: { WebApp: { platform: 'ios' } },
  };

  delete require.cache[require.resolve(join(root, 'src/modules/devices.js'))];
  require(join(root, 'src/modules/devices.js'));

  let mutationCalls = 0;
  global.window.GhostLinkV3.initDevicesModule({
    showToast: () => {},
    copyText: async () => true,
    openOverlay: () => {},
    closeOverlay: () => {},
    returnToHome: () => {},
    profileSubscription: {
      getApiBase: () => 'https://api.112prd.ru',
      getToken: () => 'safe-token',
    },
    deviceList: {
      fetchList: async () => ({
        devices: [
          {
            id: 'dev-1',
            name: 'Device 1',
            url: 'https://api.112prd.ru:2053/s/tok1#GhostLink',
            url_incy: 'https://api.112prd.ru:2053/s/tok1?compat=incy#GhostLink',
          },
          {
            id: 'dev-2',
            name: 'Device 2',
            url: 'https://api.112prd.ru:2053/s/tok2#GhostLink',
            url_incy: 'https://api.112prd.ru:2053/s/tok2?compat=incy#GhostLink',
          },
        ],
        usedSlots: 2,
        deviceLimit: 3,
        freeSlots: 1,
      }),
    },
    deviceOperations: {
      createDevice: async () => { mutationCalls += 1; return {}; },
    },
  });

  const devicesModule = global.window.GhostLinkV3.devices;

  // Select Device 2
  devicesModule.selectDeviceForSetup({
    id: 'dev-2',
    name: 'Device 2',
    url: 'https://api.112prd.ru:2053/s/tok2#GhostLink',
    url_incy: 'https://api.112prd.ru:2053/s/tok2?compat=incy#GhostLink',
  });

  assert.equal(devicesModule.getSelectedSetupDeviceId(), 'dev-2');
  assert.equal(devicesModule.getSubscriptionUrl('karing'), 'https://api.112prd.ru:2053/s/tok2#GhostLink');
  assert.equal(devicesModule.getSubscriptionUrl('incy'), 'https://api.112prd.ru:2053/s/tok2?compat=incy#GhostLink');
  assert.match(devicesModule.getSubscriptionUrl('incy'), /compat=incy/);
  assert.doesNotMatch(devicesModule.getSubscriptionUrl('karing'), /compat=incy/);
  assert.equal(mutationCalls, 0, 'selecting an app or device must not trigger creation or consume a slot');
});

test('3. add, rotate, remove enforce verified API contract with X-Request-ID and no fake-success', async () => {
  const calls = [];
  const adapter = createRealDeviceAdapter({
    apiBase: 'https://api.112prd.ru',
    getToken: () => 'auth-token',
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/api/device/add')) {
        return createMockResponse(200, {
          ok: true,
          device: {
            id: 'new-uuid-3',
            name: 'Work Laptop',
            url: 'https://api.112prd.ru:2053/s/tok3#GhostLink',
            url_incy: 'https://api.112prd.ru:2053/s/tok3?compat=incy#GhostLink',
          },
          request_id: 'req-add-1',
        });
      }
      if (url.endsWith('/api/device/rotate')) {
        return createMockResponse(200, {
          ok: true,
          device: {
            id: 'rotated-uuid-3',
            name: 'Work Laptop',
            url: 'https://api.112prd.ru:2053/s/tok3-new#GhostLink',
            url_incy: 'https://api.112prd.ru:2053/s/tok3-new?compat=incy#GhostLink',
          },
          request_id: 'req-rot-1',
        });
      }
      if (url.endsWith('/api/device/remove')) {
        return createMockResponse(200, {
          ok: true,
          deleted_id: 'rotated-uuid-3',
          connected_devices: 1,
          device_limit: 3,
          request_id: 'req-rem-1',
        });
      }
      return createMockResponse(404, { detail: 'not_found' });
    },
  });

  // Test add
  const addRes = await adapter.createDevice({ requestId: 'req-add-1', name: 'Work Laptop', platform: 'laptop' });
  assert.equal(addRes.status, 'succeeded');
  assert.equal(addRes.device.id, 'new-uuid-3');
  assert.equal(calls[0].url, 'https://api.112prd.ru/api/device/add');
  assert.equal(calls[0].options.headers['X-Request-ID'], 'req-add-1');
  assert.match(calls[0].options.body, /"device_name":"Work Laptop"/);

  // Test rotate
  const rotRes = await adapter.start({ requestId: 'req-rot-1', type: 'rotate', deviceId: 'new-uuid-3' });
  assert.equal(rotRes.status, 'succeeded');
  assert.equal(rotRes.type, 'rotate');
  assert.equal(rotRes.device.id, 'rotated-uuid-3');
  assert.equal(calls[1].url, 'https://api.112prd.ru/api/device/rotate');
  assert.equal(calls[1].options.headers['X-Request-ID'], 'req-rot-1');
  assert.match(calls[1].options.body, /"device_id":"new-uuid-3"/);

  // Test remove
  const remRes = await adapter.start({ requestId: 'req-rem-1', type: 'remove', deviceId: 'rotated-uuid-3' });
  assert.equal(remRes.status, 'succeeded');
  assert.equal(remRes.type, 'remove');
  assert.equal(remRes.deletedId, 'rotated-uuid-3');
  assert.equal(calls[2].url, 'https://api.112prd.ru/api/device/remove');
  assert.equal(calls[2].options.headers['X-Request-ID'], 'req-rem-1');

  // Verify failure rejects without fake-success
  const failingAdapter = createRealDeviceAdapter({
    apiBase: 'https://api.112prd.ru',
    getToken: () => 'auth-token',
    fetch: async () => createMockResponse(500, { detail: 'panel_pair_delete_failed' }),
  });

  await assert.rejects(
    failingAdapter.start({ requestId: 'req-fail-1', type: 'remove', deviceId: 'some-id' }),
    (err) => err.status === 500 && err.data?.detail === 'panel_pair_delete_failed',
  );
});

test('4. store navigation URLs for App Store, Google Play, macOS and Windows are correct and safe', () => {
  const source = readFileSync(join(root, 'src', 'modules', 'devices.js'), 'utf8');

  // App Store (iOS, macOS)
  assert.match(source, /https:\/\/apps\.apple\.com\/app\/incy\/id6756943388/);
  assert.match(source, /https:\/\/apps\.apple\.com\/app\/karing\/id6472431552/);

  // Google Play (Android)
  assert.match(source, /https:\/\/play\.google\.com\/store\/apps\/details\?id=llc\.itdev\.incy/);

  // GitHub Release APK / Windows Release
  assert.match(source, /https:\/\/github\.com\/KaringX\/karing\/releases\/download\/.*\.apk/);
  assert.match(source, /https:\/\/github\.com\/KaringX\/karing\/releases\/tag\//);

  // Safe window.open with noopener,noreferrer
  assert.match(source, /window\.open\(targetUrl,\s*'_blank',\s*'noopener,noreferrer'\)/);
  assert.match(source, /Telegram\.WebApp\.openLink/);
});

test('5. zero mock fallback: no mock://, no Math.random, no /api/device/reset', () => {
  const devicesSource = readFileSync(join(root, 'src', 'modules', 'devices.js'), 'utf8');
  const mainSource = readFileSync(join(root, 'src', 'main.js'), 'utf8');

  assert.doesNotMatch(devicesSource, /mock:\/\//);
  assert.doesNotMatch(devicesSource, /Math\.random/);
  assert.doesNotMatch(devicesSource, /\/api\/device\/reset/);
  assert.match(mainSource, /createRealDeviceAdapter/);
  assert.doesNotMatch(mainSource, /createMockDeviceList|createLocalDeviceListAdapter/);
});
