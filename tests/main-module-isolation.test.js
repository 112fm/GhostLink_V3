const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

test('secondary failures do not interrupt boot and admin runtime starts only for a verified admin profile', () => {
  const calls = [];
  let notifyProfile = null;
  const GhostLinkV3 = {
    createClipboard: () => () => true,
    createToast: () => ({ show: () => {} }),
    createOverlayNavigator: () => ({ open: () => {}, close: () => {}, home: () => {} }),
    createRealBlock1Adapter: () => ({
      fetchProfileSubscription: async () => ({}),
      subscribe: (callback) => {
        notifyProfile = callback;
        return () => {};
      },
    }),
    createRealDeviceAdapter: () => ({}),
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
    'home', 'diagnostics', 'subscription', 'devices', 'invites', 'support', 'help',
  ]);

  notifyProfile({ user: { is_admin: false } });
  assert.equal(calls.includes('payment-settings'), false);
  assert.equal(calls.includes('admin'), false);

  assert.doesNotThrow(() => notifyProfile({ user: { is_admin: true } }));
  assert.equal(calls.filter((call) => call === 'payment-settings').length, 1);
  assert.equal(calls.filter((call) => call === 'admin').length, 1);
});

test('runtime cache versions load the isolated home lifecycle and gift adapter', () => {
  const template = fs.readFileSync(path.join(root, 'src', 'templates', 'index.template.html'), 'utf8');

  assert.match(template, /real-block1-adapter\.js\?v=20/);
  assert.match(template, /real-device-adapter\.js\?v=20/);
  assert.match(template, /modules\/home\.js\?v=20/);
  assert.match(template, /modules\/devices\.js\?v=20/);
  assert.match(template, /modules\/admin\.js\?v=20/);
  assert.match(template, /src\/main\.js\?v=20/);
});

test('admin source never auto-starts the partners tab during page load', () => {
  const adminSource = fs.readFileSync(path.join(root, 'src', 'modules', 'admin.js'), 'utf8');

  assert.doesNotMatch(adminSource, /DOMContentLoaded[\s\S]{0,220}initPartnersTab\(\)/);
  assert.doesNotMatch(adminSource, /else\s*\{\s*if \(document\.getElementById\('admin-tab-partners'\)\)\s*\{\s*initPartnersTab\(\)/);
});
