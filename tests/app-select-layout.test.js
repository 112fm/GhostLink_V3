const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const css = readFileSync(join(root, 'src/css/page-app-select.css'), 'utf8');

test('app selection keeps mobile actions fixed but releases them on desktop', () => {
  const mobileBar = css.match(/\.app-select-bottom-bar\s*\{([\s\S]*?)\n\}/);

  assert.ok(mobileBar);
  assert.match(mobileBar[1], /position:\s*absolute/);
  assert.match(css, /@media \(min-width: 600px\)[\s\S]*?#page-app-select\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /@media \(min-width: 600px\)[\s\S]*?\.app-select-bottom-bar\s*\{[\s\S]*?position:\s*static/);
});

test('key view overlay does not contain duplicate finish button or hidden guide banner', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /id=["']btn-key-view-finish["']/);
  assert.doesNotMatch(html, /id=["']btn-open-bot-guide["']/);
});

test('app select auto-highlights INCY for mobile/mac and Karing for win/linux/tv', () => {
  const elements = new Map();
  function createMockElement(id = '', tagName = 'div') {
    const classes = new Set();
    let checked = false;
    let textContent = '';
    return {
      id,
      tagName: tagName.toUpperCase(),
      get checked() { return checked; },
      set checked(v) { checked = Boolean(v); },
      get textContent() { return textContent; },
      set textContent(v) { textContent = String(v); },
      classList: {
        add: (...names) => names.forEach(n => classes.add(n)),
        remove: (...names) => names.forEach(n => classes.delete(n)),
        contains: (name) => classes.has(name),
      },
      addEventListener: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      removeAttribute: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      style: {},
    };
  }

  function getOrCreateElement(id) {
    if (!elements.has(id)) elements.set(id, createMockElement(id));
    return elements.get(id);
  }

  const radioIncy = createMockElement('radio-incy', 'input');
  radioIncy.value = 'incy';
  const radioKaring = createMockElement('radio-karing', 'input');
  radioKaring.value = 'karing';

  const mockDoc = {
    readyState: 'complete',
    getElementById: (id) => getOrCreateElement(id),
    querySelector: (sel) => {
      if (sel.includes('value="incy"')) return radioIncy;
      if (sel.includes('value="karing"')) return radioKaring;
      return null;
    },
    querySelectorAll: () => [radioIncy, radioKaring],
    addEventListener: () => {},
  };

  global.window = {
    document: mockDoc,
    GhostLinkV3: {},
    Telegram: { WebApp: { platform: 'ios' } },
  };
  global.document = mockDoc;
  global.navigator = { userAgent: 'iPhone' };

  require(join(root, 'src/modules/devices.js'));
  global.window.GhostLinkV3.initDevicesModule({
    showToast: () => {},
    copyText: () => true,
    openOverlay: () => {},
    closeOverlay: () => {},
    returnToHome: () => {},
  });

  const { autoSelectDefaultAppForCurrentPlatform } = global.window.GhostLinkV3.devices;

  // Test iOS -> INCY
  assert.equal(autoSelectDefaultAppForCurrentPlatform('ios'), 'incy');
  assert.equal(getOrCreateElement('app-card-incy').classList.contains('active'), true);
  assert.equal(getOrCreateElement('app-card-karing').classList.contains('active'), false);
  assert.equal(getOrCreateElement('install-app-btn-text').textContent, 'Установить INCY');

  // Test Android -> INCY
  assert.equal(autoSelectDefaultAppForCurrentPlatform('android'), 'incy');
  assert.equal(getOrCreateElement('app-card-incy').classList.contains('active'), true);
  assert.equal(getOrCreateElement('app-card-karing').classList.contains('active'), false);

  // Test macOS -> INCY
  assert.equal(autoSelectDefaultAppForCurrentPlatform('macos'), 'incy');
  assert.equal(getOrCreateElement('app-card-incy').classList.contains('active'), true);
  assert.equal(getOrCreateElement('app-card-karing').classList.contains('active'), false);

  // Test Windows -> Karing
  assert.equal(autoSelectDefaultAppForCurrentPlatform('windows'), 'karing');
  assert.equal(getOrCreateElement('app-card-karing').classList.contains('active'), true);
  assert.equal(getOrCreateElement('app-card-incy').classList.contains('active'), false);
  assert.equal(getOrCreateElement('install-app-btn-text').textContent, 'Установить Karing');

  // Test Linux -> Karing
  assert.equal(autoSelectDefaultAppForCurrentPlatform('linux'), 'karing');
  assert.equal(getOrCreateElement('app-card-karing').classList.contains('active'), true);
  assert.equal(getOrCreateElement('app-card-incy').classList.contains('active'), false);

  // Test TV -> Karing
  assert.equal(autoSelectDefaultAppForCurrentPlatform('tv'), 'karing');
  assert.equal(getOrCreateElement('app-card-karing').classList.contains('active'), true);
  assert.equal(getOrCreateElement('app-card-incy').classList.contains('active'), false);
});

