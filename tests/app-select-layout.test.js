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

test('switching the application is UI-only and never creates a device or consumes a slot', () => {
  const devicesSource = readFileSync(join(root, 'src/modules/devices.js'), 'utf8');
  const start = devicesSource.indexOf('function selectAppChoice(app)');
  const end = devicesSource.indexOf('function autoSelectDefaultAppForCurrentPlatform', start);
  const selectionSource = devicesSource.slice(start, end);

  assert.ok(start >= 0 && end > start, 'application choice handler must exist');
  assert.doesNotMatch(selectionSource, /startDeviceOperation|createDevice|addOperationDevice/);
});

test('subscription URL builder exposes only API-provided Karing and INCY URLs with zero vless strings', () => {
  const { getSubscriptionUrl } = global.window.GhostLinkV3.devices;

  // Missing API fields must not create a displayable or copyable URL.
  assert.equal(getSubscriptionUrl('karing'), '');
  assert.equal(getSubscriptionUrl('incy'), '');

  // Verify full codebase (source & html) has zero vless:// occurrences
  const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
  const devicesJs = readFileSync(join(root, 'src/modules/devices.js'), 'utf8');
  const devicesHtml = readFileSync(join(root, 'src/templates/pages/devices.html'), 'utf8');

  assert.doesNotMatch(indexHtml, /vless:\/\//);
  assert.doesNotMatch(devicesJs, /vless:\/\//);
  assert.doesNotMatch(devicesHtml, /vless:\/\//);
});

test('regression 1: account-wide INCY URL is not used without a selected device', async () => {
  const elements = new Map();
  let textCopied = '';
  function createMockElement(id = '', tagName = 'div') {
    let textContent = '';
    let disabled = false;
    const spanEl = {
      tagName: 'SPAN',
      get textContent() { return textContent; },
      set textContent(v) { textContent = String(v); },
      replaceChildren: (...ch) => { textContent = ch.map(c => typeof c === 'string' ? c : c?.textContent || '').join(''); },
      appendChild: (c) => { textContent += typeof c === 'string' ? c : c?.textContent || ''; },
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      style: {},
    };
    return {
      id,
      tagName: tagName.toUpperCase(),
      get disabled() { return disabled; },
      set disabled(v) { disabled = Boolean(v); },
      get textContent() { return textContent; },
      set textContent(v) { textContent = String(v); },
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      addEventListener: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      removeAttribute: () => {},
      replaceChildren: (...ch) => { textContent = ch.map(c => typeof c === 'string' ? c : c?.textContent || '').join(''); },
      appendChild: (c) => { textContent += typeof c === 'string' ? c : c?.textContent || ''; },
      querySelector: (sel) => (sel === 'span' ? spanEl : null),
      querySelectorAll: () => [],
      style: {},
    };
  }

  const mockDoc = {
    readyState: 'complete',
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, createMockElement(id));
      return elements.get(id);
    },
    createElement: (tag) => createMockElement('', tag),
    createTextNode: (text) => ({ textContent: String(text) }),
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
    getSubToken: () => 'sub_backend_123',
    getToken: () => '64a85816bb6e42b109e3e7f41753eb5efc28cb20d3f231e3d36b8110b91e92d6',
    getCachedProfile: () => ({
      user: {
        id: 'u1',
        url_incy: 'https://api.112prd.ru:2053/sub/custom_incy_token?compat=incy',
        subscription_url: 'https://api.112prd.ru:2053/sub/custom_karing_token',
      },
    }),
    getSnapshot: () => ({
      user: {
        id: 'u1',
        url_incy: 'https://api.112prd.ru:2053/sub/custom_incy_token?compat=incy',
        subscription_url: 'https://api.112prd.ru:2053/sub/custom_karing_token',
      },
    }),
    subscribe: () => () => {},
  };

  delete require.cache[require.resolve(join(root, 'src/modules/devices.js'))];
  require(join(root, 'src/modules/devices.js'));
  global.window.GhostLinkV3.initDevicesModule({
    showToast: () => {},
    copyText: async (t) => { textCopied = t; return true; },
    openOverlay: () => {},
    closeOverlay: () => {},
    returnToHome: () => {},
    profileSubscription: mockProfileSubscription,
  });

  const { getSubscriptionUrl, isSubscriptionReady } = global.window.GhostLinkV3.devices;
  const btnAddToApp = mockDoc.getElementById('btn-add-to-app');

  assert.equal(isSubscriptionReady('incy'), false);
  assert.equal(btnAddToApp.disabled, true);
  assert.equal(btnAddToApp.querySelector('span').textContent, 'Ссылка для INCY недоступна');
  assert.equal(getSubscriptionUrl('incy'), '');
});

test('regression 2: when url_incy is absent, INCY button is disabled and does not build synthetic url from sub_token', () => {
  const elements = new Map();
  function createMockElement(id = '', tagName = 'div') {
    let textContent = '';
    let disabled = false;
    const spanEl = {
      tagName: 'SPAN',
      get textContent() { return textContent; },
      set textContent(v) { textContent = String(v); },
      replaceChildren: (...ch) => { textContent = ch.map(c => typeof c === 'string' ? c : c?.textContent || '').join(''); },
      appendChild: (c) => { textContent += typeof c === 'string' ? c : c?.textContent || ''; },
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      style: {},
    };
    return {
      id,
      tagName: tagName.toUpperCase(),
      get disabled() { return disabled; },
      set disabled(v) { disabled = Boolean(v); },
      get textContent() { return textContent; },
      set textContent(v) { textContent = String(v); },
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      addEventListener: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      removeAttribute: () => {},
      replaceChildren: (...ch) => { textContent = ch.map(c => typeof c === 'string' ? c : c?.textContent || '').join(''); },
      appendChild: (c) => { textContent += typeof c === 'string' ? c : c?.textContent || ''; },
      querySelector: (sel) => (sel === 'span' ? spanEl : null),
      querySelectorAll: () => [],
      style: {},
    };
  }

  const mockDoc = {
    readyState: 'complete',
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, createMockElement(id));
      return elements.get(id);
    },
    createElement: (tag) => createMockElement('', tag),
    createTextNode: (text) => ({ textContent: String(text) }),
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

  // Profile has sub_token, but NO url_incy
  const mockProfileSubscription = {
    getSubToken: () => 'my_sub_token_xyz',
    getToken: () => '64a85816bb6e42b109e3e7f41753eb5efc28cb20d3f231e3d36b8110b91e92d6',
    getCachedProfile: () => ({
      user: {
        id: 'u2',
        sub_token: 'my_sub_token_xyz',
      },
    }),
    getSnapshot: () => ({
      user: {
        id: 'u2',
        sub_token: 'my_sub_token_xyz',
      },
    }),
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

  const { getSubscriptionUrl, isSubscriptionReady } = global.window.GhostLinkV3.devices;
  const btnAddToApp = mockDoc.getElementById('btn-add-to-app');

  assert.equal(isSubscriptionReady('incy'), false);
  assert.equal(btnAddToApp.disabled, true);
  assert.equal(btnAddToApp.querySelector('span').textContent, 'Ссылка для INCY недоступна');
  assert.equal(getSubscriptionUrl('incy'), '');
});

test('regression 3: account-wide Karing URL is not used without a selected device', () => {
  const elements = new Map();
  function createMockElement(id = '', tagName = 'div') {
    let textContent = '';
    let disabled = false;
    const spanEl = {
      tagName: 'SPAN',
      get textContent() { return textContent; },
      set textContent(v) { textContent = String(v); },
      replaceChildren: (...ch) => { textContent = ch.map(c => typeof c === 'string' ? c : c?.textContent || '').join(''); },
      appendChild: (c) => { textContent += typeof c === 'string' ? c : c?.textContent || ''; },
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      style: {},
    };
    return {
      id,
      tagName: tagName.toUpperCase(),
      get disabled() { return disabled; },
      set disabled(v) { disabled = Boolean(v); },
      get textContent() { return textContent; },
      set textContent(v) { textContent = String(v); },
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      addEventListener: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      removeAttribute: () => {},
      replaceChildren: (...ch) => { textContent = ch.map(c => typeof c === 'string' ? c : c?.textContent || '').join(''); },
      appendChild: (c) => { textContent += typeof c === 'string' ? c : c?.textContent || ''; },
      querySelector: (sel) => (sel === 'span' ? spanEl : null),
      querySelectorAll: () => [],
      style: {},
    };
  }

  const mockDoc = {
    readyState: 'complete',
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, createMockElement(id));
      return elements.get(id);
    },
    createElement: (tag) => createMockElement('', tag),
    createTextNode: (text) => ({ textContent: String(text) }),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  };

  global.window = {
    document: mockDoc,
    GhostLinkV3: {},
    Telegram: { WebApp: { platform: 'tdesktop', openLink: () => {} } },
  };
  global.document = mockDoc;
  global.navigator = { userAgent: 'Windows NT 10.0' };

  // Profile has valid url for Karing
  const mockProfileSubscription = {
    getSubToken: () => 'sub_karing_111',
    getToken: () => '64a85816bb6e42b109e3e7f41753eb5efc28cb20d3f231e3d36b8110b91e92d6',
    getCachedProfile: () => ({
      user: {
        id: 'u3',
        subscription_url: 'https://api.112prd.ru:2053/sub/official_karing_url',
      },
    }),
    getSnapshot: () => ({
      user: {
        id: 'u3',
        subscription_url: 'https://api.112prd.ru:2053/sub/official_karing_url',
      },
    }),
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

  const { getSubscriptionUrl, isSubscriptionReady, selectAppChoice } = global.window.GhostLinkV3.devices;
  selectAppChoice('karing');

  const btnAddToApp = mockDoc.getElementById('btn-add-to-app');
  assert.equal(isSubscriptionReady('karing'), false);
  assert.equal(btnAddToApp.disabled, true);
  assert.equal(btnAddToApp.querySelector('span').textContent, 'Ссылка для Karing недоступна');
  assert.equal(getSubscriptionUrl('karing'), '');
});

test('subscription token stays separate from device-scoped subscription URLs', () => {
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
    getCachedProfile: () => ({
      user: {
        sub_token: 'sub_live_999',
        subscription_url: 'https://api.112prd.ru:2053/sub/sub_live_999',
        url_incy: 'https://api.112prd.ru:2053/sub/sub_live_999?compat=incy',
      },
    }),
    getSnapshot: () => ({
      user: {
        sub_token: 'sub_live_999',
        subscription_url: 'https://api.112prd.ru:2053/sub/sub_live_999',
        url_incy: 'https://api.112prd.ru:2053/sub/sub_live_999?compat=incy',
      },
    }),
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
  assert.equal(getSubscriptionUrl('karing'), '');
  assert.equal(getSubscriptionUrl('incy'), '');

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
  assert.equal(getSubscriptionUrl('karing'), '');
  assert.equal(getSubscriptionUrl('incy'), '');
});

test('mapProfile and getCurrentUserToken robustly extract sub_token from subscription_url', () => {
  const { mapProfile } = require(join(root, 'src/api/real-block1-adapter.js'));

  // Test mapProfile extraction
  const mapped = mapProfile({
    user: { id: '777', name: 'tester' },
    subscription: { status: 'active', expiry: '2026-12-31' },
    subscription_url: 'https://api.112prd.ru:2053/sub/Oe6Sa-G7Hs9tVJR9xwRqT1iYztBQ8lAz',
  });

  assert.equal(mapped.user.sub_token, 'Oe6Sa-G7Hs9tVJR9xwRqT1iYztBQ8lAz');
  assert.equal(mapped.profile.sub_token, 'Oe6Sa-G7Hs9tVJR9xwRqT1iYztBQ8lAz');
  assert.equal(mapped.sub_token, 'Oe6Sa-G7Hs9tVJR9xwRqT1iYztBQ8lAz');

  // Test devices module extraction from subscription_url candidate
  const mockDoc = {
    readyState: 'complete',
    getElementById: () => null,
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
    getSubToken: () => '',
    getToken: () => '64a85816bb6e42b109e3e7f41753eb5efc28cb20d3f231e3d36b8110b91e92d6',
    getCachedProfile: () => ({
      user: { id: '777' },
      subscription_url: 'https://api.112prd.ru:2053/sub/Oe6Sa-G7Hs9tVJR9xwRqT1iYztBQ8lAz',
      url_incy: 'https://api.112prd.ru:2053/sub/Oe6Sa-G7Hs9tVJR9xwRqT1iYztBQ8lAz?compat=incy',
    }),
    getSnapshot: () => ({
      user: { id: '777' },
      subscription_url: 'https://api.112prd.ru:2053/sub/Oe6Sa-G7Hs9tVJR9xwRqT1iYztBQ8lAz',
      url_incy: 'https://api.112prd.ru:2053/sub/Oe6Sa-G7Hs9tVJR9xwRqT1iYztBQ8lAz?compat=incy',
    }),
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
  assert.equal(getCurrentUserToken(), 'Oe6Sa-G7Hs9tVJR9xwRqT1iYztBQ8lAz');
  assert.equal(getSubscriptionUrl('karing'), '');
  assert.equal(getSubscriptionUrl('incy'), '');
});

test('devices module consumes backend url/url_incy directly and disables btnAddToApp until subscription is ready', () => {
  const elements = new Map();
  function createMockElement(id = '', tagName = 'div') {
    const classes = new Set();
    let checked = false;
    let textContent = '';
    let disabled = false;
    const spanEl = {
      tagName: 'SPAN',
      get textContent() { return textContent; },
      set textContent(v) { textContent = String(v); },
      replaceChildren: (...children) => {
        textContent = children.map(c => (typeof c === 'string' ? c : c?.textContent || '')).join('');
      },
      appendChild: (c) => {
        textContent += (typeof c === 'string' ? c : c?.textContent || '');
      },
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false,
      },
      style: {},
    };
    return {
      id,
      tagName: tagName.toUpperCase(),
      get checked() { return checked; },
      set checked(v) { checked = Boolean(v); },
      get disabled() { return disabled; },
      set disabled(v) { disabled = Boolean(v); },
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
      replaceChildren: (...children) => {
        textContent = children.map(c => (typeof c === 'string' ? c : c?.textContent || '')).join('');
      },
      appendChild: (c) => {
        textContent += (typeof c === 'string' ? c : c?.textContent || '');
      },
      querySelector: (sel) => (sel === 'span' ? spanEl : null),
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
    createElement: (tag) => createMockElement('', tag),
    createTextNode: (text) => ({ textContent: String(text) }),
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

  let currentProfile = null;
  let subscriberCallback = null;

  const mockProfileSubscription = {
    getSubToken: () => currentProfile?.user?.sub_token || '',
    getToken: () => '64a85816bb6e42b109e3e7f41753eb5efc28cb20d3f231e3d36b8110b91e92d6',
    getCachedProfile: () => currentProfile,
    getSnapshot: () => currentProfile,
    subscribe: (cb) => {
      subscriberCallback = cb;
      return () => {};
    },
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

  const { getSubscriptionUrl, isSubscriptionReady, updateDisplayedSubscriptionUrls } = global.window.GhostLinkV3.devices;
  const btnAddToApp = getOrCreateElement('btn-add-to-app');

  // Initial State: profile not loaded yet (default app is INCY for iPhone)
  assert.equal(isSubscriptionReady('incy'), false);
  assert.equal(btnAddToApp.disabled, true);
  assert.equal(btnAddToApp.querySelector('span').textContent, 'Ссылка для INCY недоступна');
  assert.equal(getSubscriptionUrl('karing'), '');
  assert.equal(getSubscriptionUrl('incy'), '');

  // Backend response arrives with direct url and url_incy
  currentProfile = {
    user: {
      id: '888',
      subscription_url: 'https://api.112prd.ru:2053/sub/my_karing_custom',
      url_incy: 'https://api.112prd.ru:2053/sub/my_incy_custom?compat=incy',
      sub_token: 'my_sub_token_888',
    },
  };

  subscriberCallback(currentProfile);

  assert.equal(isSubscriptionReady('incy'), false);
  assert.equal(btnAddToApp.disabled, true);
  assert.equal(btnAddToApp.querySelector('span').textContent, 'Ссылка для INCY недоступна');
  assert.equal(getSubscriptionUrl('karing'), '');
  assert.equal(getSubscriptionUrl('incy'), '');

  // Test switching to Karing
  const { selectAppChoice } = global.window.GhostLinkV3.devices;
  selectAppChoice('karing');
  assert.equal(isSubscriptionReady('karing'), false);
  assert.equal(btnAddToApp.disabled, true);
  assert.equal(btnAddToApp.querySelector('span').textContent, 'Ссылка для Karing недоступна');
});

test('regression: selected device without URL and profile with sub_token does not generate URL and disables button', () => {
  const elements = new Map();
  function createMockElement(id = '', tagName = 'div') {
    let textContent = '';
    let disabled = false;
    const spanEl = {
      tagName: 'SPAN',
      get textContent() { return textContent; },
      set textContent(v) { textContent = String(v); },
      replaceChildren: (...ch) => { textContent = ch.map(c => typeof c === 'string' ? c : c?.textContent || '').join(''); },
      appendChild: (c) => { textContent += typeof c === 'string' ? c : c?.textContent || ''; },
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      style: {},
    };
    return {
      id,
      tagName: tagName.toUpperCase(),
      get disabled() { return disabled; },
      set disabled(v) { disabled = Boolean(v); },
      get textContent() { return textContent; },
      set textContent(v) { textContent = String(v); },
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      addEventListener: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      removeAttribute: () => {},
      replaceChildren: (...ch) => { textContent = ch.map(c => typeof c === 'string' ? c : c?.textContent || '').join(''); },
      appendChild: (c) => { textContent += typeof c === 'string' ? c : c?.textContent || ''; },
      querySelector: (sel) => (sel === 'span' ? spanEl : null),
      querySelectorAll: () => [],
      style: {},
    };
  }

  const mockDoc = {
    readyState: 'complete',
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, createMockElement(id));
      return elements.get(id);
    },
    createElement: (tag) => createMockElement('', tag),
    createTextNode: (text) => ({ textContent: String(text) }),
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
    getSubToken: () => 'profile_sub_token_999',
    getToken: () => 'auth_token_999',
    getCachedProfile: () => ({
      user: {
        id: 'u999',
        sub_token: 'profile_sub_token_999',
      },
    }),
    getSnapshot: () => ({
      user: {
        id: 'u999',
        sub_token: 'profile_sub_token_999',
      },
    }),
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

  const { getSubscriptionUrl, isSubscriptionReady, selectDeviceForSetup, selectAppChoice } = global.window.GhostLinkV3.devices;
  const btnAddToApp = mockDoc.getElementById('btn-add-to-app');

  // Select a device that has NO url and NO url_incy
  selectDeviceForSetup({
    id: 'dev-empty-urls',
    name: 'Empty URLs Device',
    platform: 'ios',
    url: '',
    url_incy: '',
  });

  // Default app for iPhone is INCY
  selectAppChoice('incy');
  assert.equal(getSubscriptionUrl('incy'), '');
  assert.equal(isSubscriptionReady('incy'), false);
  assert.equal(btnAddToApp.disabled, true);
  assert.equal(btnAddToApp.querySelector('span').textContent, 'Ссылка для INCY недоступна');

  // Switch to Karing
  selectAppChoice('karing');
  assert.equal(getSubscriptionUrl('karing'), '');
  assert.equal(isSubscriptionReady('karing'), false);
  assert.equal(btnAddToApp.disabled, true);
  assert.equal(btnAddToApp.querySelector('span').textContent, 'Ссылка для Karing недоступна');

  // Now select a device that has only Karing url
  selectDeviceForSetup({
    id: 'dev-karing-only',
    name: 'Karing Only Device',
    platform: 'ios',
    url: 'https://api.112prd.ru:2053/sub/karing_only_token',
    url_incy: '',
  });

  selectAppChoice('incy');
  assert.equal(getSubscriptionUrl('incy'), '');
  assert.equal(isSubscriptionReady('incy'), false);
  assert.equal(btnAddToApp.disabled, true);
  assert.equal(btnAddToApp.querySelector('span').textContent, 'Ссылка для INCY недоступна');

  selectAppChoice('karing');
  assert.equal(getSubscriptionUrl('karing'), 'https://api.112prd.ru:2053/sub/karing_only_token');
  assert.equal(isSubscriptionReady('karing'), true);
  assert.equal(btnAddToApp.disabled, false);
  assert.equal(btnAddToApp.querySelector('span').textContent, 'Добавить в Karing');
});




