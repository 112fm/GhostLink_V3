const test = require('node:test');
const assert = require('node:assert/strict');

const { createMockDeviceOperations } = require('../src/mocks/device-operations.js');

function createMemoryStorage() {
  const records = new Map();
  return {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, String(value)),
    removeItem: (key) => records.delete(key),
  };
}

test('one request_id produces one operation and a second POST conflicts', async () => {
  const operations = createMockDeviceOperations({ storage: createMemoryStorage() });
  const accepted = await operations.createDevice({ requestId: 'req-one' });
  const conflict = await operations.createDevice({ requestId: 'req-one' });

  assert.equal(accepted.status, 'accepted');
  assert.equal(conflict.status, 'conflict');
  assert.equal(conflict.code, 'request_conflict');
  assert.equal(operations.getCreateCount(), 1);
});

test('accepted operation progresses through processing to succeeded once', async () => {
  const operations = createMockDeviceOperations({ storage: createMemoryStorage() });
  await operations.createDevice({ requestId: 'req-success' });

  assert.equal((await operations.getStatus('req-success')).status, 'processing');
  const succeeded = await operations.getStatus('req-success');
  assert.equal(succeeded.status, 'succeeded');
  assert.match(succeeded.device.setupToken, /^mock-device-/);
  assert.doesNotMatch(succeeded.device.setupToken, /^vless:/i);
  assert.equal(succeeded.device.url, 'mock://req-success/karing');
  assert.equal(succeeded.device.url_incy, 'mock://req-success/incy');
});

test('a late status read cannot overwrite the completed device result', async () => {
  const operations = createMockDeviceOperations({ storage: createMemoryStorage() });
  await operations.createDevice({ requestId: 'req-late-status' });
  await operations.getStatus('req-late-status');
  const completed = await operations.getStatus('req-late-status');
  const lateRead = await operations.getStatus('req-late-status');

  assert.equal(completed.status, 'succeeded');
  assert.deepEqual(lateRead, completed);
  assert.equal(operations.getCreateCount(), 1);
});

test('accepted operation can end as failed without another create request', async () => {
  const operations = createMockDeviceOperations({ storage: createMemoryStorage() });
  await operations.createDevice({ requestId: 'req-failed', scenario: 'failed' });

  await operations.getStatus('req-failed');
  const failed = await operations.getStatus('req-failed');
  assert.equal(failed.status, 'failed');
  assert.equal(failed.code, 'mock_verification_failed');
  assert.equal(operations.getCreateCount(), 1);
});

test('device limit is a business result, not a transport retry', async () => {
  const operations = createMockDeviceOperations({ storage: createMemoryStorage() });
  const result = await operations.createDevice({ requestId: 'req-limit', scenario: 'limit' });

  assert.equal(result.status, 'failed');
  assert.equal(result.code, 'device_limit_reached');
  assert.equal(operations.getCreateCount(), 1);
  assert.equal(await operations.getStatus('req-limit'), null);
});

test('timeout preserves the operation so the same request_id can be checked later', async () => {
  const operations = createMockDeviceOperations({ storage: createMemoryStorage() });

  await assert.rejects(
    operations.createDevice({ requestId: 'req-timeout', scenario: 'timeout' }),
    (error) => error.type === 'timeout',
  );

  const status = await operations.getStatus('req-timeout');
  assert.equal(status.status, 'processing');
  assert.equal(operations.getCreateCount(), 1);
});

test('a rapid retry after timeout conflicts instead of creating a second operation', async () => {
  const operations = createMockDeviceOperations({ storage: createMemoryStorage() });
  await assert.rejects(
    operations.createDevice({ requestId: 'req-timeout-retry', scenario: 'timeout' }),
    (error) => error.type === 'timeout',
  );

  const retry = await operations.createDevice({ requestId: 'req-timeout-retry' });
  assert.equal(retry.status, 'conflict');
  assert.equal(operations.getCreateCount(), 1);
});

test('operation status survives adapter recreation during polling', async () => {
  const storage = createMemoryStorage();
  const firstRuntime = createMockDeviceOperations({ storage });
  await firstRuntime.createDevice({ requestId: 'req-reload' });
  await firstRuntime.getStatus('req-reload');

  const afterReload = createMockDeviceOperations({ storage });
  const status = await afterReload.getStatus('req-reload');
  assert.equal(status.status, 'succeeded');
  assert.equal(status.requestId, 'req-reload');
});

test('offline status polling keeps the request intact until the connection returns', async () => {
  const operations = createMockDeviceOperations({ storage: createMemoryStorage() });
  await operations.createDevice({ requestId: 'req-offline' });
  operations.setOnline(false);

  await assert.rejects(
    operations.getStatus('req-offline'),
    (error) => error.type === 'network',
  );

  operations.setOnline(true);
  assert.equal((await operations.getStatus('req-offline')).requestId, 'req-offline');
  assert.equal(operations.getCreateCount(), 1);
});

test('a lost first response replays the saved result with the same request_id and creates one mock device', async () => {
  const operations = createMockDeviceOperations({ storage: createMemoryStorage() });
  const requestId = 'req-lost-response';
  const payload = { requestId, target: 'this-device', scenario: 'lost-response', ownerId: 'owner-a' };

  await assert.rejects(operations.createDevice(payload), (error) => error.type === 'timeout');
  await operations.getStatus(requestId, { ownerId: 'owner-a' });
  const succeededWithoutResult = await operations.getStatus(requestId, { ownerId: 'owner-a' });
  const replay = await operations.createDevice({ ...payload, replay: true });

  assert.equal(succeededWithoutResult.status, 'succeeded');
  assert.equal(succeededWithoutResult.device, null);
  assert.equal(replay.status, 'succeeded');
  assert.match(replay.device.setupToken, /^mock-device-/);
  assert.equal(operations.getCreateCount(), 1);
});

test('a changed payload or foreign owner cannot reuse a saved device operation', async () => {
  const operations = createMockDeviceOperations({ storage: createMemoryStorage() });
  const requestId = 'req-replay-owner';
  const payload = { requestId, target: 'this-device', scenario: 'lost-response', ownerId: 'owner-a' };

  await assert.rejects(operations.createDevice(payload), (error) => error.type === 'timeout');

  const changedPayload = await operations.createDevice({ ...payload, target: 'other-device', replay: true });
  const foreignReplay = await operations.createDevice({ ...payload, ownerId: 'owner-b', replay: true });
  const foreignStatus = await operations.getStatus(requestId, { ownerId: 'owner-b' });

  assert.equal(changedPayload.status, 'conflict');
  assert.equal(changedPayload.code, 'request_conflict');
  assert.equal(foreignReplay.status, 'failed');
  assert.equal(foreignReplay.code, 'request_forbidden');
  assert.equal(foreignStatus, null);
  assert.equal(operations.getCreateCount(), 1);
});

test('a saved lost-response operation can be replayed after local reopening', async () => {
  const storage = createMemoryStorage();
  const requestId = 'req-replay-reload';
  const payload = { requestId, target: 'other-device', scenario: 'lost-response', ownerId: 'owner-a' };
  const firstRuntime = createMockDeviceOperations({ storage });

  await assert.rejects(firstRuntime.createDevice(payload), (error) => error.type === 'timeout');
  await firstRuntime.getStatus(requestId, { ownerId: 'owner-a' });
  await firstRuntime.getStatus(requestId, { ownerId: 'owner-a' });

  const reopenedRuntime = createMockDeviceOperations({ storage });
  const replay = await reopenedRuntime.createDevice({ ...payload, replay: true });
  assert.equal(replay.status, 'succeeded');
  assert.equal(replay.device.id, `mock-device-${requestId}`);
  assert.equal(reopenedRuntime.getCreateCount(), 0);
});
