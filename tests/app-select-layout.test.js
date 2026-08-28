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

test('canonical subscription URL builder handles karing, incy, tokens and fallbacks with zero vless strings', () => {
  const { getSubscriptionUrl } = global.window.GhostLinkV3.devices;

  assert.equal(
    getSubscriptionUrl('karing', 'tok_abc123'),
    'https://api.112prd.ru:2053/sub/tok_abc123'
  );
  assert.equal(
    getSubscriptionUrl('incy', 'tok_abc123'),
    'https://api.112prd.ru:2053/sub/tok_abc123?compat=incy'
  );

  // Fallbacks with empty or missing token
  assert.equal(
    getSubscriptionUrl('karing', ''),
    'https://api.112prd.ru:2053/sub/••••••••'
  );
  assert.equal(
    getSubscriptionUrl('incy', ''),
    'https://api.112prd.ru:2053/sub/••••••••?compat=incy'
  );
  assert.equal(
    getSubscriptionUrl('karing', null),
    'https://api.112prd.ru:2053/sub/••••••••'
  );

  // Verify full codebase (source & html) has zero vless:// occurrences
  const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
  const devicesJs = readFileSync(join(root, 'src/modules/devices.js'), 'utf8');
  const devicesHtml = readFileSync(join(root, 'src/templates/pages/devices.html'), 'utf8');

  assert.doesNotMatch(indexHtml, /vless:\/\//);
  assert.doesNotMatch(devicesJs, /vless:\/\//);
  assert.doesNotMatch(devicesHtml, /vless:\/\//);
});

test('subscription token prioritizes sub_token from profile snapshot and adapter', () => {
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

  const mockDoc = {
    readyState: 'complete',
    getElementById: (id) => getOrCreateElement(id),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  };

  global.window = {
    document: mockDoc,
    GhostLinkV3: {},
    Telegram: { WebApp: { platform: 'ios', openLink: () => {} } },
  };
  global.document = mockDoc;
  global.navigator = { userAgent: 'iPhone' };

  const mockProfileSubscription = {
    getSubToken: () => 'sub_live_999',
    getToken: () => 'legacy_token_111',
    getCachedProfile: () => ({ user: { sub_token: 'sub_live_999' } }),
    getSnapshot: () => ({ user: { sub_token: 'sub_live_999' } }),
    subscribe: () => () => {},
  };

  delete require.cache[require.resolve(join(root, 'src/modules/devices.js'))];
  require(join(root, 'src/modules/devices.js'));
  global.window.GhostLinkV3.initDevicesModule({
    showToast: () => {},
    copyText: () => true,
    openOverlay: () => {},
    closeOverlay: () => {},
    returnToHome: () => {},
    profileSubscription: mockProfileSubscription,
  });

  const { getCurrentUserToken, getSubscriptionUrl, isValidSubToken } = global.window.GhostLinkV3.devices;
  assert.equal(getCurrentUserToken(), 'sub_live_999');
  assert.equal(getSubscriptionUrl('karing'), 'https://api.112prd.ru:2053/sub/sub_live_999');
  assert.equal(getSubscriptionUrl('incy'), 'https://api.112prd.ru:2053/sub/sub_live_999?compat=incy');

  // Test isValidSubToken
  assert.equal(isValidSubToken('Oe6Sa-G7Hs9tVJR9xwRqT1iYztBQ8lAz'), true);
  assert.equal(isValidSubToken('sub_live_999'), true);
  assert.equal(isValidSubToken('64a85816bb6e42b109e3e7f41753eb5efc28cb20d3f231e3d36b8110b91e92d6'), false);
  assert.equal(isValidSubToken('a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'), false);
  assert.equal(isValidSubToken(''), false);
  assert.equal(isValidSubToken(null), false);
  assert.equal(isValidSubToken(undefined), false);
});

test('getCurrentUserToken strictly excludes 64-char session token when sub_token is absent', () => {
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

  const mockDoc = {
    readyState: 'complete',
    getElementById: (id) => getOrCreateElement(id),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  };

  global.window = {
    document: mockDoc,
    GhostLinkV3: {},
    Telegram: { WebApp: { platform: 'ios', openLink: () => {} } },
  };
  global.document = mockDoc;
  global.navigator = { userAgent: 'iPhone' };

  // Only has 64-hex session token, no user sub_token
  const mockProfileSubscription = {
    getSubToken: () => '',
    getToken: () => '64a85816bb6e42b109e3e7f41753eb5efc28cb20d3f231e3d36b8110b91e92d6',
    getCachedProfile: () => ({ user: { id: '123' } }),
    getSnapshot: () => ({ user: { id: '123' } }),
    subscribe: () => () => {},
  };

  delete require.cache[require.resolve(join(root, 'src/modules/devices.js'))];
  require(join(root, 'src/modules/devices.js'));
  global.window.GhostLinkV3.initDevicesModule({
    showToast: () => {},
    copyText: () => true,
    openOverlay: () => {},
    closeOverlay: () => {},
    returnToHome: () => {},
    profileSubscription: mockProfileSubscription,
  });

  const { getCurrentUserToken, getSubscriptionUrl } = global.window.GhostLinkV3.devices;
  assert.equal(getCurrentUserToken(), '');
  assert.equal(getSubscriptionUrl('karing'), 'https://api.112prd.ru:2053/sub/••••••••');
  assert.equal(getSubscriptionUrl('incy'), 'https://api.112prd.ru:2053/sub/••••••••?compat=incy');
});




