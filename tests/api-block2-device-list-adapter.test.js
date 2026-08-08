const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  createLocalDeviceListAdapter,
  formatDeviceTraffic,
  formatLastOnline,
  normalizeDeviceListResponse,
} = require('../src/api/local-block2-device-list-adapter.js');

const root = path.resolve(__dirname, '..');
const NOW = Date.UTC(2026, 7, 3, 12, 0, 0);

function response(overrides = {}) {
  return {
    connected: 1,
    device_limit: 3,
    items: [{
      uuid: 'a63e3fc2-ec47-4b27-866c-9a60be1b6a53',
      email: 'Мой iPhone',
      last_online: Math.floor((NOW - 2 * 60 * 1000) / 1000),
      up: 1024,
      down: 2048,
      subscription_url: 'https://example.invalid/private-subscription',
    }],
    ...overrides,
  };
}

test('Block 2 maps one device into a safe V3 card and derives slots from the API response', async () => {
  const adapter = createLocalDeviceListAdapter({ response: response(), now: () => NOW });
  const snapshot = await adapter.fetchList();

  assert.equal(snapshot.status, 'loaded');
  assert.equal(snapshot.usedSlots, 1);
  assert.equal(snapshot.deviceLimit, 3);
  assert.equal(snapshot.freeSlots, 2);
  assert.deepEqual(snapshot.devices[0], {
    id: 'a63e3fc2-ec47-4b27-866c-9a60be1b6a53',
    name: 'Мой iPhone',
    platform: 'unknown',
    app: 'Не определено',
    status: 'online',
    lastActive: 'Онлайн сейчас',
    traffic: '3 КБ',
    isCurrent: false,
  });
  assert.equal(JSON.stringify(snapshot).includes('subscription_url'), false);
  assert.equal(JSON.stringify(snapshot).includes('private-subscription'), false);
});

test('Block 2 maps several cards without claiming a platform from the email label', () => {
  const snapshot = normalizeDeviceListResponse(response({
    connected: 2,
    device_limit: 5,
    items: [
      { uuid: 'first', email: 'MacBook Артёма', last_online: NOW - 2 * 60 * 60 * 1000, up: 0, down: 0 },
      { uuid: 'second', email: '', last_online: NOW - 3 * 24 * 60 * 60 * 1000, up: 1024 ** 3, down: 0 },
    ],
  }), { now: NOW });

  assert.equal(snapshot.devices.length, 2);
  assert.equal(snapshot.devices[0].platform, 'unknown');
  assert.equal(snapshot.devices[0].lastActive, '2 ч. назад');
  assert.equal(snapshot.devices[1].name, 'Устройство 2');
  assert.equal(snapshot.devices[1].traffic, '1 ГБ');
  assert.equal(snapshot.freeSlots, 3);
});

test('Block 2 keeps empty and full lists as successful explicit states', () => {
  const empty = normalizeDeviceListResponse(response({ connected: 0, device_limit: 2, items: [] }), { now: NOW });
  const full = normalizeDeviceListResponse(response({ connected: 2, device_limit: 2, items: [{ uuid: 'one' }, { uuid: 'two' }] }), { now: NOW });

  assert.equal(empty.status, 'empty');
  assert.equal(empty.freeSlots, 2);
  assert.equal(full.status, 'limit');
  assert.equal(full.freeSlots, 0);
});

test('Block 2 has one safe mapper for invalid last_online and traffic values', () => {
  assert.equal(formatLastOnline(null, NOW), 'Нет данных');
  assert.equal(formatLastOnline('not-a-date', NOW), 'Нет данных');
  assert.equal(formatLastOnline(0, NOW), 'Нет данных');
  assert.equal(formatDeviceTraffic(-1, 'broken'), '0 Б');
});

test('Block 2 reports offline and timeout without replacing the local response', async () => {
  const adapter = createLocalDeviceListAdapter({ response: response(), now: () => NOW });
  await adapter.fetchList();

  adapter.setMode('offline');
  await assert.rejects(adapter.fetchList(), (error) => error.type === 'network');
  adapter.setMode('timeout');
  await assert.rejects(adapter.fetchList(), (error) => error.type === 'timeout');
  adapter.setMode('loaded');

  const retry = await adapter.fetchList();
  assert.equal(retry.devices[0].id, 'a63e3fc2-ec47-4b27-866c-9a60be1b6a53');
});

test('Block 2 preserves existing local mock mutations in memory without storing raw device data', async () => {
  const adapter = createLocalDeviceListAdapter({ response: response(), now: () => NOW });
  await adapter.fetchList();

  assert.equal(adapter.addOperationDevice({
    target: 'this-device',
    device: { id: 'local-created-device', name: 'Локальное устройство' },
  }), true);
  assert.equal(adapter.applyMutation({ status: 'succeeded', type: 'remove', deviceId: 'local-created-device' }), true);

  const snapshot = await adapter.fetchList();
  assert.equal(snapshot.devices.some((device) => device.id === 'local-created-device'), false);
  assert.equal(snapshot.usedSlots, 1);
});

test('Block 2 never persists raw list data or exposes subscription URLs in source or runtime graph', () => {
  const adapterSource = fs.readFileSync(path.join(root, 'src/api/local-block2-device-list-adapter.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'src/templates/index.template.html'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');

  assert.doesNotMatch(adapterSource, /localStorage|sessionStorage|fetch\(|XMLHttpRequest|WebSocket|https?:\/\//);
  assert.match(template, /src="\.\/src\/api\/local-block2-device-list-adapter\.js\?v=3"/);
  assert.match(main, /createLocalDeviceListAdapter/);
});
