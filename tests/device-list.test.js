const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createMockDeviceList } = require('../src/mocks/device-list.js');

const root = path.resolve(__dirname, '..');

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('loaded list exposes used and free slots from one snapshot', async () => {
  const list = createMockDeviceList({ storage: createMemoryStorage() });
  const snapshot = await list.fetchList();

  assert.equal(snapshot.status, 'loaded');
  assert.equal(snapshot.usedSlots, 3);
  assert.equal(snapshot.deviceLimit, 5);
  assert.equal(snapshot.freeSlots, 2);
  assert.equal(snapshot.devices.length, 3);
});

test('empty list is an explicit successful state, not an error', async () => {
  const list = createMockDeviceList({ storage: createMemoryStorage(), devices: [] });
  const snapshot = await list.fetchList();

  assert.equal(snapshot.status, 'empty');
  assert.equal(snapshot.usedSlots, 0);
  assert.equal(snapshot.freeSlots, 5);
});

test('reaching the slot limit produces a loaded limit state', async () => {
  const list = createMockDeviceList({
    storage: createMemoryStorage(),
    deviceLimit: 2,
    devices: [{ id: 'one' }, { id: 'two' }],
  });
  const snapshot = await list.fetchList();

  assert.equal(snapshot.status, 'limit');
  assert.equal(snapshot.usedSlots, 2);
  assert.equal(snapshot.freeSlots, 0);
});

test('operation result is added once and cannot exceed device limit', async () => {
  const list = createMockDeviceList({
    storage: createMemoryStorage(),
    deviceLimit: 2,
    devices: [{ id: 'existing' }],
  });
  const result = { id: 'mock-device-request-1', name: 'Локальное тестовое устройство', setupToken: 'mock-device-request-1' };

  assert.equal(list.addOperationDevice({ requestId: 'request-1', target: 'this-device', device: result }), true);
  assert.equal(list.addOperationDevice({ requestId: 'request-1', target: 'this-device', device: result }), true);
  assert.equal(list.addOperationDevice({ requestId: 'request-2', target: 'other-device', device: { id: 'overflow' } }), false);

  const snapshot = await list.fetchList();
  assert.equal(snapshot.usedSlots, 2);
  assert.equal(snapshot.status, 'limit');
  assert.equal(snapshot.devices.filter((device) => device.id === result.id).length, 1);
});

test('offline and timeout leave the saved list available for a later retry', async () => {
  const list = createMockDeviceList({ storage: createMemoryStorage() });
  await list.fetchList();

  list.setMode('offline');
  await assert.rejects(list.fetchList(), (error) => error.type === 'network');

  list.setMode('timeout');
  await assert.rejects(list.fetchList(), (error) => error.type === 'timeout');

  list.setMode('loaded');
  const retried = await list.fetchList();
  assert.equal(retried.status, 'loaded');
  assert.equal(retried.devices.length, 3);
});

test('concurrent refreshes share one local request', async () => {
  const list = createMockDeviceList({ storage: createMemoryStorage(), delayMs: 5 });
  const [first, second] = await Promise.all([list.fetchList(), list.fetchList()]);

  assert.deepEqual(first, second);
  assert.equal(list.getFetchCount(), 1);
});

test('device template exposes the current dynamic list controls', () => {
  const template = fs.readFileSync(path.join(root, 'src/templates/pages/devices.html'), 'utf8');

  ['devices-slot-summary', 'devices-slot-free', 'devices-list-status', 'active-devices-container', 'devices-empty-state', 'devices-unavailable-state', 'btn-devices-add'].forEach((id) => {
    assert.match(template, new RegExp(`id="${id}"`));
  });
  assert.doesNotMatch(template, /legacy-device-list-markup|btnToggleDevicesHistory|historyAccordionContent|btn-delete-device-action/);
});

test('settings never shows a made-up device count before the list loads', () => {
  const settingsTemplate = fs.readFileSync(path.join(root, 'src/templates/pages/settings.html'), 'utf8');
  const subtitle = settingsTemplate.match(/id="settings-devices-subtitle">([^<]+)</);

  assert.ok(subtitle);
  assert.equal(subtitle[1].trim(), 'Проверяем устройства…');
});
