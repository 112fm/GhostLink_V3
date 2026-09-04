const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const template = readFileSync(join(root, 'src/templates/pages/devices.html'), 'utf8');
const css = readFileSync(join(root, 'src/css/page-settings.css'), 'utf8');

test('device list header reserves the fixed help area without inline positioning', () => {
  assert.match(template, /<header class="page-header devices-list-header">/);
  assert.doesNotMatch(template, /id="page-devices-list"[\s\S]*?justify-content:\s*space-between/);
  assert.match(css, /\.devices-list-header\s*\{[\s\S]*?justify-content:\s*flex-start/);
  assert.match(css, /@media \(min-width: 600px\)[\s\S]*?\.devices-list-header\s*\{[\s\S]*?padding-right:\s*110px/);
});

const devicesCss = readFileSync(join(root, 'src/css/page-devices.css'), 'utf8');
const devicesJs = readFileSync(join(root, 'src/modules/devices.js'), 'utf8');

test('device-apple-card uses Bento glassmorphism styling without neon borders', () => {
  assert.match(devicesCss, /\.device-apple-card\s*\{[\s\S]*?background:\s*rgba\(24,\s*27,\s*24,\s*0\.75\);/);
  assert.match(devicesCss, /\.device-apple-card\s*\{[\s\S]*?border:\s*1px\s*solid\s*rgba\(255,\s*255,\s*255,\s*0\.08\);/);
  assert.match(devicesCss, /\.device-apple-card\s*\{[\s\S]*?border-radius:\s*18px;/);
  assert.match(devicesCss, /\.device-apple-card\s*\{[\s\S]*?backdrop-filter:\s*blur\(20px\);/);
});

test('platform icons use circular soft-background badges and vector SVGs', () => {
  assert.match(devicesCss, /\.device-platform-icon[\s\S]*?border-radius:\s*50%;/);
  assert.match(devicesCss, /\.device-platform-icon[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.05\);/);
  assert.match(devicesJs, /function getDevicePlatformSvg/);
  // Verify that yellow key emoji is not used in card rendering
  assert.doesNotMatch(devicesJs, /emoji\.textContent\s*=\s*getDeviceEmoji/);
  assert.match(devicesJs, /emoji\.innerHTML\s*=\s*getDevicePlatformSvg/);
});

test('action buttons feature compact lime connect and compact trash icon button', () => {
  assert.match(devicesCss, /\.device-card-action--connect\s*\{[\s\S]*?color:\s*var\(--lime\);/);
  assert.match(devicesCss, /\.device-card-action--remove\s*\{[\s\S]*?width:\s*38px;/);
  assert.match(devicesCss, /\.device-card-action--remove:hover[\s\S]*?color:\s*#ff5c5c;/);
  assert.match(devicesJs, /btnRemove\.innerHTML\s*=[\s\S]*?<svg/);
});

test('redundant status text is hidden and slot summary banner is modernized', () => {
  assert.match(devicesCss, /#devices-list-status[\s\S]*?display:\s*none\s*!important;/);
  assert.match(devicesCss, /\.devices-slot-summary\s*\{[\s\S]*?background:\s*rgba\(20,\s*22,\s*20,\s*0\.65\);/);
  assert.match(devicesCss, /\.devices-slot-summary\s*\{[\s\S]*?backdrop-filter:\s*blur\(16px\);/);
  assert.match(devicesCss, /\.devices-slot-summary\s*\{[\s\S]*?border-radius:\s*18px;/);
});

test('mobile scroll is unblocked on devices list with ample bottom padding', () => {
  assert.match(devicesCss, /#page-devices-list\s*\{[\s\S]*?overflow-y:\s*auto\s*!important;/);
  assert.match(devicesCss, /#page-devices-list\s*\{[\s\S]*?-webkit-overflow-scrolling:\s*touch;/);
  assert.match(devicesCss, /#page-devices-list\s*\{[\s\S]*?height:\s*100%;/);
  assert.match(devicesCss, /\.devices-page-content\s*\{[\s\S]*?padding-bottom:\s*calc\(180px\s*\+\s*env\(safe-area-inset-bottom,\s*24px\)\)\s*!important;/);
});

test('delete and add-device modals feature centered hero icons, modern actions and no blue outline', () => {
  // Confirm Delete Modal
  assert.match(template, /id="modalConfirmDeleteDevice"[\s\S]*?class="modal-content modal-content--center"/);
  assert.match(template, /class="modal-hero-icon modal-hero-icon--danger"/);
  assert.match(template, /<h3 class="modal-center-title">Освободить слот\?<\/h3>/);
  assert.match(template, /id="btnConfirmDeleteSubmit"/);
  assert.match(template, /id="btnConfirmDeleteCancel"/);

  // Add Device Modal
  assert.match(template, /id="modalAddDeviceName"[\s\S]*?class="modal-content modal-content--center"/);
  assert.match(template, /class="modal-hero-icon modal-hero-icon--lime"/);
  assert.match(template, /<h3 class="modal-center-title">Новое устройство<\/h3>/);
  assert.match(template, /id="addDeviceNameInput"/);
  assert.match(template, /id="btnAddDeviceSubmit"/);

  // CSS rules
  assert.match(devicesCss, /\.modal-hero-icon--danger\s*\{[\s\S]*?background:\s*rgba\(255,\s*69,\s*58,\s*0\.15\);/);
  assert.match(devicesCss, /\.modal-hero-icon--lime\s*\{[\s\S]*?background:\s*rgba\(184,\s*255,\s*0,\s*0\.12\);/);
  assert.match(devicesCss, /#btnConfirmDeleteSubmit[\s\S]*?background:\s*rgba\(255,\s*69,\s*58,\s*0\.16\);/);
  assert.match(devicesCss, /#addDeviceNameInput[\s\S]*?outline:\s*none;/);
  assert.match(devicesCss, /#addDeviceNameInput:focus[\s\S]*?border-color:\s*var\(--lime\);/);
  assert.match(devicesCss, /#btnAddDeviceSubmit[\s\S]*?background:\s*var\(--lime\);/);
});

test('confirmDeviceDeletion formats device name safely in strong tag and deletes single device', () => {
  assert.match(devicesJs, /function escapeHtml/);
  assert.match(devicesJs, /function confirmDeviceDeletion\(device\)/);
  assert.match(devicesJs, /modalText\.innerHTML\s*=\s*`Доступ для устройства <strong style="color: #fff;">\$\{devName\}<\/strong> будет отключен, а слот станет доступен для нового подключения\.`;/);
  assert.match(devicesJs, /startDeviceMutation\(device,\s*'remove'\)/);
});

const contextHelpCss = readFileSync(join(root, 'src/css/context-help.css'), 'utf8');

test('help button is hidden when any modal overlay is active or body has modal open', () => {
  assert.match(contextHelpCss, /body:has\(\.modal-overlay:not\(\.hidden\)\)\s*#helpButton/);
  assert.match(contextHelpCss, /body:has\(\.page-overlay:not\(\.hidden\)\)\s*#helpButton/);
  assert.match(contextHelpCss, /body\.has-modal-open\s*#helpButton/);
  assert.match(contextHelpCss, /body\.has-overlay-open\s*#helpButton/);
  assert.match(contextHelpCss, /\.modal-overlay:not\(\.hidden\)\s*~\s*\* #helpButton/);
  assert.match(contextHelpCss, /display:\s*none\s*!important/);
  assert.match(devicesJs, /function syncModalBodyState/);
  assert.match(devicesJs, /document\.body\.classList\.toggle\('has-modal-open'/);
});

test('device card connect button is ⚙️ Настроить and opens openDeviceManageView', () => {
  assert.match(devicesJs, /btnConnect\.textContent\s*=\s*isBusy \? 'Загрузка\.\.\.' : '⚙️ Настроить';/);
  assert.match(devicesJs, /btnConnect\.addEventListener\('click',\s*\(\)\s*=>\s*openDeviceManageView\(device\)\);/);
  assert.match(devicesJs, /function openDeviceManageView\(device\)/);
  assert.match(devicesJs, /openDeviceManageView,/);
});

test('smart routing banner and key app switcher exist in template and CSS', () => {
  assert.match(template, /id="smart-routing-banner"/);
  assert.match(template, /Умный обход РФ сайтов активен/);
  assert.match(template, /Банки \(Сбер, Т-Банк\), Госуслуги, Ozon и VK работают напрямую/);
  assert.match(template, /id="key-app-switcher"/);
  assert.match(template, /id="key-tab-incy"/);
  assert.match(template, /id="key-tab-karing"/);

  assert.match(devicesCss, /\.smart-routing-banner\s*\{[\s\S]*?border:\s*1px\s*solid\s*rgba\(184,\s*255,\s*0,\s*0\.22\);/);
  assert.match(devicesCss, /\.key-app-switcher\s*\{[\s\S]*?display:\s*flex;/);
  assert.match(devicesCss, /\.key-app-tab\.active\s*\{[\s\S]*?color:\s*var\(--lime\);/);
});

test('strict platform detection prevents cross-platform isCurrent false positives', () => {
  const elements = new Map();
  function createElement(id = '') {
    const listeners = new Map();
    const children = [];
    return {
      id,
      children,
      dataset: {},
      style: {},
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        toggle(c, force) { if (force !== undefined) { force ? this.add(c) : this.remove(c); } else { this._classes.has(c) ? this.remove(c) : this.add(c); } },
        contains(c) { return this._classes.has(c); },
      },
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
    body: createElement('body'),
  };

  global.document = documentMock;
  global.navigator = { userAgent: 'Macintosh; Intel Mac OS X 10_15_7' };
  global.window = {
    document: documentMock,
    crypto: { randomUUID: () => 'test-req-mac-1' },
    GhostLinkV3: { apiBase: 'https://api.112prd.ru' },
    Telegram: { WebApp: { platform: 'macos' } },
  };

  delete require.cache[require.resolve(join(root, 'src', 'modules', 'devices.js'))];
  require(join(root, 'src', 'modules', 'devices.js'));

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
  });

  const devicesMod = global.window.GhostLinkV3.devices;
  assert.equal(devicesMod.getDevicePlatform(), 'macos');

  // iPhone device marked isCurrent: true by backend must NOT be recognized as "This device" on Mac
  const iphoneDevice = {
    id: 'dev-1',
    name: 'Мой iPhone',
    platform: 'ios',
    isCurrent: true,
  };
  assert.equal(devicesMod.isDeviceCurrentForPlatform(iphoneDevice, 'macos'), false);

  // Mac device marked isCurrent: true IS recognized on Mac
  const macDevice = {
    id: 'dev-2',
    name: 'Мой MacBook',
    platform: 'macos',
    isCurrent: true,
  };
  assert.equal(devicesMod.isDeviceCurrentForPlatform(macDevice, 'macos'), true);

  // Platform normalization checks
  assert.equal(devicesMod.getDeviceNormalizedPlatform({ name: 'iPhone 15' }), 'ios');
  assert.equal(devicesMod.getDeviceNormalizedPlatform({ name: 'MacBook Air' }), 'macos');
  assert.equal(devicesMod.getDeviceNormalizedPlatform({ name: 'Домашний ПК', platform: 'windows' }), 'windows');
  assert.equal(devicesMod.getDeviceNormalizedPlatform({ name: 'Samsung S24', platform: 'android' }), 'android');
});



