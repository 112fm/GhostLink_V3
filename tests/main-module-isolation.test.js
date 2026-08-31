const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

test('secondary invites and admin failures do not interrupt the V3 boot lifecycle', () => {
  const calls = [];
  const GhostLinkV3 = {
    createClipboard: () => () => true,
    createToast: () => ({ show: () => {} }),
    createOverlayNavigator: () => ({ open: () => {}, close: () => {}, home: () => {} }),
    createRealBlock1Adapter: () => ({ fetchProfileSubscription: async () => ({}) }),
    createLocalDeviceListAdapter: () => ({}),
    createMockInvites: () => ({}),
    createMockSupport: () => ({}),
    initHomeModule: () => calls.push('home'),
    initDiagnosticsModule: () => calls.push('diagnostics'),
    initSubscriptionModule: () => calls.push('subscription'),
    initDevicesModule: () => calls.push('devices'),
    initInvitesModule: () => {
      calls.push('invites');
      throw new Error('invites failed');
    },
    initSupportModule: () => calls.push('support'),
    initContextHelpModule: () => calls.push('help'),
    initAdminPaymentSettingsModule: () => calls.push('payment-settings'),
    initAdminModule: () => {
      calls.push('admin');
      throw new Error('admin failed');
    },
  };
  const source = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
  const context = {
    window: { GhostLinkV3 },
    document: { getElementById: () => ({}) },
    URLSearchParams,
    setTimeout,
    clearTimeout,
  };

  assert.doesNotThrow(() => vm.runInNewContext(source, context));
  assert.deepEqual(calls, [
    'home', 'diagnostics', 'subscription', 'devices', 'invites',
    'support', 'help', 'payment-settings', 'admin',
  ]);
});

test('runtime cache versions load the isolated home lifecycle and gift adapter', () => {
  const template = fs.readFileSync(path.join(root, 'src', 'templates', 'index.template.html'), 'utf8');

  assert.match(template, /real-block1-adapter\.js\?v=9/);
  assert.match(template, /modules\/home\.js\?v=9/);
  assert.match(template, /src\/main\.js\?v=8/);
});
