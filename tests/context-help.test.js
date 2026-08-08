const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const modulePath = path.join(root, 'src/modules/context-help.js');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const source = fs.readFileSync(modulePath, 'utf8');
const {
  HELP_CONTENT,
  ADMIN_OVERLAYS,
  resolveHelpKey,
  getTourForContext,
} = require(modulePath);

test('each client tab resolves to its own help key', () => {
  assert.equal(resolveHelpKey({ tabId: 'tab-home' }), 'home');
  assert.equal(resolveHelpKey({ tabId: 'tab-referral', referralMode: 'standard' }), 'referral');
  assert.equal(resolveHelpKey({ tabId: 'tab-referral', referralMode: 'bridge' }), 'referral');
  assert.equal(resolveHelpKey({ tabId: 'tab-support' }), null);
  assert.equal(resolveHelpKey({ tabId: 'tab-settings' }), 'settings');
});

test('home and referral tours stay single-page and sequential', () => {
  const homeTour = getTourForContext({ tabId: 'tab-home' });
  assert.equal(homeTour.length, 3);
  assert.deepEqual(homeTour.map((step) => step.selector), [
    '#subscriptionStatus',
    '.bento-extend',
    '.bento-setup',
  ]);

  const standardTour = getTourForContext({ tabId: 'tab-referral', referralMode: 'standard' });
  const bridgeTour = getTourForContext({ tabId: 'tab-referral', referralMode: 'bridge' });
  assert.deepEqual(bridgeTour, standardTour);
  assert.match(standardTour[0].description, /Мост 2\.0/);
  assert.doesNotMatch(standardTour[0].description, /VPN/i);
  assert.ok(standardTour.some((step) => step.selector === '.referral-mode-tabs'));
});

test('each client overlay resolves only to its own help tour', () => {
  const expected = {
    'page-extend': 'extend',
    'page-checkout': 'checkout',
    'page-setup': 'setup',
    'page-app-select': 'app-select',
    'page-key-view': 'key-view',
    'page-other-device': 'other-device',
    'page-device-detail': 'device-detail',
    'page-devices-list': 'devices-list',
  };

  Object.entries(expected).forEach(([overlayId, key]) => {
    assert.equal(resolveHelpKey({ overlayId }), key, overlayId);
  });

  assert.equal(resolveHelpKey({ overlayId: 'page-privacy-policy' }), null, 'page-privacy-policy');
});

test('checkout status gets a separate tour and never falls back to another page', () => {
  assert.equal(resolveHelpKey({ overlayId: 'page-checkout', checkoutView: 'form' }), 'checkout');
  assert.equal(resolveHelpKey({ overlayId: 'page-checkout', checkoutView: 'pending' }), 'payment-pending');
  assert.equal(resolveHelpKey({ overlayId: 'page-checkout', checkoutView: 'approved' }), 'payment-approved');
  assert.equal(resolveHelpKey({ overlayId: 'page-checkout', checkoutView: 'rejected' }), 'payment-rejected');

  const checkoutTour = getTourForContext({ overlayId: 'page-checkout', checkoutView: 'pending' });
  assert.equal(checkoutTour[0].scope, 'overlay');
  assert.match(checkoutTour[0].selector, /#checkout-pending-view/);
  assert.ok(checkoutTour.every((step) => step.scope === 'overlay'));
});

test('admin overlays never receive client help', () => {
  ADMIN_OVERLAYS.forEach((overlayId) => {
    assert.equal(resolveHelpKey({ overlayId, tabId: 'tab-home' }), null, overlayId);
    assert.equal(getTourForContext({ overlayId }), null, overlayId);
  });
});

test('help registry has isolated concise steps and scoped selectors', () => {
  const serialized = JSON.stringify(HELP_CONTENT).toLowerCase();
  assert.doesNotMatch(serialized, /админ|сервер/);

  Object.entries(HELP_CONTENT).forEach(([key, tour]) => {
    assert.ok(tour.title, `${key}: missing title`);
    assert.ok(tour.steps.length > 0 && tour.steps.length <= 5, `${key}: expected 1-5 steps`);
    tour.steps.forEach((step) => {
      assert.ok(step.selector, `${key}: missing selector`);
      assert.ok(step.title, `${key}: missing step title`);
      assert.ok(step.description, `${key}: missing step description`);
      assert.match(step.scope, /^(tab|overlay)$/);
    });
  });
});

test('device help targets only the active device-list and setup DOM', () => {
  const devicesTemplate = fs.readFileSync(path.join(root, 'src/templates/pages/devices.html'), 'utf8');
  const deviceTour = getTourForContext({ overlayId: 'page-devices-list' });
  const setupTour = getTourForContext({ overlayId: 'page-setup' });
  const removedLegacySelectors = /legacy-device-list-markup|btnToggleDevicesHistory|historyAccordionContent|btn-delete-device-action/;

  assert.deepEqual(deviceTour.map((step) => step.selector), [
    '#devices-slot-summary',
    '#active-devices-container',
    '#btn-devices-add',
  ]);
  [...deviceTour, ...setupTour].forEach((step) => {
    const id = step.selector.match(/^#([\w-]+)$/)?.[1];
    assert.ok(id && devicesTemplate.includes(`id="${id}"`), `${step.selector} must exist in the current devices template`);
    assert.doesNotMatch(step.selector, removedLegacySelectors);
  });
  assert.doesNotMatch(source, removedLegacySelectors);
});

test('HTML has one client trigger and sketchbook annotation markup', () => {
  assert.equal((html.match(/id=["']helpButton["']/g) || []).length, 1);
  assert.match(html, /id=["']contextHelpBackdrop["']/);
  assert.match(html, /id=["']contextHelpShadeTop["']/);
  assert.match(html, /id=["']contextHelpShadeBottom["']/);
  assert.match(html, /id=["']contextTourSpotlight["']/);
  assert.match(html, /id=["']contextHelpAnnotation["']/);
  assert.match(html, /id=["']contextHelpTitle["']/);
  assert.match(html, /id=["']contextHelpDescription["']/);
  assert.match(html, /id=["']contextTourNextBtn["']/);
  assert.match(html, /id=["']contextHelpClose["']/);
  assert.doesNotMatch(html, /class=["'][^"']*context-help-sheet/);
});

test('help module loads before main boot and uses safe DOM text rendering', () => {
  assert.match(html, /src\/css\/context-help\.css/);
  assert.ok(html.indexOf('src/modules/context-help.js') < html.indexOf('src/main.js'));
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.doesNotMatch(source, /PAGE_TOURS/);
});

test('spotlight keeps highlighted content sharp instead of blurring the target', () => {
  const css = fs.readFileSync(path.join(root, 'src/css/context-help.css'), 'utf8');
  assert.doesNotMatch(css, /\.context-help-backdrop[\s\S]*backdrop-filter/);
  assert.match(css, /\.context-help-target[\s\S]*filter:\s*none\s*!important/);
});
