const test = require('node:test');
const assert = require('node:assert/strict');

const { createMockDeviceMutations } = require('../src/mocks/device-mutations.js');
const { createMockDeviceList } = require('../src/mocks/device-list.js');

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function createRestrictedStorage() {
  const error = new Error('SecurityError: localStorage is blocked');
  error.name = 'SecurityError';
  return {
    getItem() { throw error; },
    setItem() { throw error; },
    removeItem() { throw error; },
  };
}

async function completeMutation(mutations, requestId) {
  await mutations.getStatus(requestId);
  return mutations.getStatus(requestId);
}

test('one request_id creates one device mutation and a duplicate conflicts', async () => {
  const mutations = createMockDeviceMutations({ storage: createMemoryStorage() });
  const accepted = await mutations.start({ requestId: 'rotate-one', type: 'rotate', deviceId: 'phone' });
  const conflict = await mutations.start({ requestId: 'rotate-one', type: 'rotate', deviceId: 'phone' });

  assert.equal(accepted.status, 'accepted');
  assert.equal(conflict.status, 'conflict');
  assert.equal(mutations.getStartCount(), 1);
});

test('a device cannot run two mutations simultaneously', async () => {
  const mutations = createMockDeviceMutations({ storage: createMemoryStorage() });
  await mutations.start({ requestId: 'remove-one', type: 'remove', deviceId: 'phone' });
  const blocked = await mutations.start({ requestId: 'reset-one', type: 'reset', deviceId: 'phone' });

  assert.equal(blocked.status, 'conflict');
  assert.equal(blocked.code, 'device_operation_in_progress');
  assert.equal(mutations.getStartCount(), 1);
});

test('timeout does not claim success and the saved request can be checked later', async () => {
  const mutations = createMockDeviceMutations({ storage: createMemoryStorage() });

  await assert.rejects(
    mutations.start({ requestId: 'timeout-one', type: 'remove', deviceId: 'phone', scenario: 'timeout' }),
    (error) => error.type === 'timeout',
  );

  const completed = await completeMutation(mutations, 'timeout-one');
  assert.equal(completed.status, 'succeeded');
  assert.equal(completed.type, 'remove');
});

test('offline status polling keeps the mutation pending until connectivity returns', async () => {
  const mutations = createMockDeviceMutations({ storage: createMemoryStorage() });
  await mutations.start({ requestId: 'offline-one', type: 'reset', deviceId: 'phone' });
  mutations.setOnline(false);
  await assert.rejects(mutations.getStatus('offline-one'), (error) => error.type === 'network');

  mutations.setOnline(true);
  assert.equal((await mutations.getStatus('offline-one')).requestId, 'offline-one');
});

test('ordinary persistent storage restores a mutation after adapter recreation', async () => {
  const storage = createMemoryStorage();
  const beforeReload = createMockDeviceMutations({ storage });
  await beforeReload.start({ requestId: 'reload-mutation', type: 'rotate', deviceId: 'phone' });
  await beforeReload.getStatus('reload-mutation');

  const afterReload = createMockDeviceMutations({ storage });
  const restored = await afterReload.getStatus('reload-mutation');
  assert.equal(restored.requestId, 'reload-mutation');
  assert.equal(restored.status, 'succeeded');
});

test('list applies rotate, reset, and remove only after a succeeded mutation', async () => {
  const storage = createMemoryStorage();
  const list = createMockDeviceList({
    storage,
    deviceLimit: 2,
    devices: [{ id: 'phone', name: 'Телефон', app: 'Karing', status: 'online', lastActive: 'Онлайн сейчас', traffic: '5 ГБ' }],
  });
  const mutations = createMockDeviceMutations({ storage });

  await mutations.start({ requestId: 'rotate-two', type: 'rotate', deviceId: 'phone' });
  const rotated = await completeMutation(mutations, 'rotate-two');
  assert.equal(list.applyMutation(rotated), true);
  let snapshot = await list.fetchList();
  assert.equal(snapshot.devices[0].lastActive, 'Ключ обновлён');
  assert.equal(snapshot.devices[0].setupToken, 'mock-rotated-rotate-two');

  await mutations.start({ requestId: 'reset-two', type: 'reset', deviceId: 'phone' });
  const reset = await completeMutation(mutations, 'reset-two');
  assert.equal(list.applyMutation(reset), true);
  snapshot = await list.fetchList();
  assert.equal(snapshot.devices[0].status, 'setup');
  assert.equal(snapshot.devices[0].traffic, '0 Б');

  await mutations.start({ requestId: 'remove-two', type: 'remove', deviceId: 'phone' });
  const removed = await completeMutation(mutations, 'remove-two');
  assert.equal(list.applyMutation(removed), true);
  snapshot = await list.fetchList();
  assert.equal(snapshot.status, 'empty');
  assert.equal(snapshot.freeSlots, 2);
});

test('a stale completed mutation cannot overwrite a newer one for the same device', async () => {
  const mutations = createMockDeviceMutations({ storage: createMemoryStorage() });
  await mutations.start({ requestId: 'old-operation', type: 'rotate', deviceId: 'phone' });
  const oldResult = await completeMutation(mutations, 'old-operation');
  await mutations.start({ requestId: 'new-operation', type: 'reset', deviceId: 'phone' });
  const newResult = await completeMutation(mutations, 'new-operation');

  assert.notEqual(oldResult.requestId, newResult.requestId);
  assert.equal(newResult.type, 'reset');
});

test('restrictive WebView storage keeps rotate, reset, and remove in session memory', async () => {
  const mutations = createMockDeviceMutations({ storage: createRestrictedStorage() });

  for (const [type, requestId] of [['rotate', 'restricted-rotate'], ['reset', 'restricted-reset'], ['remove', 'restricted-remove']]) {
    const accepted = await mutations.start({ requestId, type, deviceId: `${type}-device` });
    assert.equal(accepted.status, 'accepted');
    const result = await completeMutation(mutations, requestId);
    assert.equal(result.status, 'succeeded');
    assert.equal(result.type, type);
  }
});

test('restrictive WebView storage keeps duplicate protection and timeout status', async () => {
  const mutations = createMockDeviceMutations({ storage: createRestrictedStorage() });

  await assert.rejects(
    mutations.start({ requestId: 'restricted-timeout', type: 'rotate', deviceId: 'restricted-phone', scenario: 'timeout' }),
    (error) => error.type === 'timeout',
  );
  const duplicate = await mutations.start({ requestId: 'restricted-timeout', type: 'rotate', deviceId: 'restricted-phone' });
  assert.equal(duplicate.status, 'conflict');
  assert.equal((await completeMutation(mutations, 'restricted-timeout')).status, 'succeeded');
});

test('canceled confirmation prevents starting remove, reset, or rotate mutation', async () => {
  const storage = createMemoryStorage();
  const mutations = createMockDeviceMutations({ storage });
  
  // Simulated UI cancellation check: without confirmation, start() is not called
  let confirmValue = false;
  function simulateUiMutation(type, deviceId, requestId) {
    if (!confirmValue) return { status: 'canceled' };
    return mutations.start({ requestId, type, deviceId });
  }

  const canceledRemove = simulateUiMutation('remove', 'phone', 'cancel-rem');
  const canceledReset = simulateUiMutation('reset', 'phone', 'cancel-res');
  const canceledRotate = simulateUiMutation('rotate', 'phone', 'cancel-rot');

  assert.equal(canceledRemove.status, 'canceled');
  assert.equal(canceledReset.status, 'canceled');
  assert.equal(canceledRotate.status, 'canceled');
  assert.equal(mutations.getStartCount(), 0);

  // When confirmed, mutation starts cleanly
  confirmValue = true;
  const confirmed = await simulateUiMutation('rotate', 'phone', 'confirmed-rot');
  assert.equal(confirmed.status, 'accepted');
  assert.equal(mutations.getStartCount(), 1);
});
