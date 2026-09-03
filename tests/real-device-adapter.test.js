const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createRealDeviceAdapter } = require(path.join(__dirname, '..', 'src', 'api', 'real-device-adapter.js'));

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

test('real device adapter maps device-scoped URLs and counters without storage', async () => {
  const calls = [];
  const adapter = createRealDeviceAdapter({
    apiBase: 'https://api.example.test',
    getToken: () => 'pwa-token',
    fetch: async (url, options) => {
      calls.push({ url, options });
      return response(200, {
        devices: [{ id: 'device-a', name: 'Телефон', url: 'https://api/sub/a', url_incy: 'https://api/sub/a?incy=1', is_current: true, is_active: true }],
        connected_devices: 1,
        device_limit: 2,
        can_add: true,
      });
    },
  });

  const snapshot = await adapter.fetchList();
  assert.equal(snapshot.devices[0].id, 'device-a');
  assert.equal(snapshot.devices[0].url, 'https://api/sub/a');
  assert.equal(snapshot.devices[0].url_incy, 'https://api/sub/a?incy=1');
  assert.equal(snapshot.usedSlots, 1);
  assert.equal(snapshot.freeSlots, 1);
  assert.equal(calls[0].options.headers['X-PWA-Token'], 'pwa-token');
});

test('real device adapter sends one request_id and polls the confirmed operation result', async () => {
  const calls = [];
  const adapter = createRealDeviceAdapter({
    apiBase: 'https://api.example.test',
    getToken: () => 'pwa-token',
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/api/device/add')) return response(202, { request_id: 'req-1', status: 'processing' });
      return response(200, { request_id: 'req-1', status: 'succeeded', result: { device: { id: 'device-b', url: 'https://api/sub/b', url_incy: 'https://api/sub/b?incy=1' } } });
    },
  });

  const accepted = await adapter.createDevice({ requestId: 'req-1', name: 'Ноутбук', platform: 'laptop' });
  const result = await adapter.getStatus('req-1');
  assert.equal(accepted.status, 'processing');
  assert.equal(result.status, 'succeeded');
  assert.equal(result.device.id, 'device-b');
  assert.equal(calls[0].options.headers['X-Request-ID'], 'req-1');
  assert.match(calls[0].options.body, /"request_id":"req-1"/);
  assert.equal(calls[1].url, 'https://api.example.test/api/device/operations/req-1');
});

test('real device adapter routes rotate/remove through authenticated operations and preserves API errors', async () => {
  const calls = [];
  const adapter = createRealDeviceAdapter({
    apiBase: 'https://api.example.test',
    getToken: () => 'pwa-token',
    fetch: async (url, options) => {
      calls.push({ url, options });
      return response(409, { detail: 'request_id_conflict' });
    },
  });

  await assert.rejects(
    adapter.start({ requestId: 'req-2', type: 'remove', deviceId: 'device-a' }),
    (error) => error.status === 409 && error.code === 'request_id_conflict',
  );
  assert.equal(calls[0].url, 'https://api.example.test/api/device/remove');
  assert.match(calls[0].options.body, /"device_id":"device-a"/);
  assert.equal(calls[0].options.headers['X-Request-ID'], 'req-2');
});

test('real device adapter turns a hanging device request into a timeout', async () => {
  const adapter = createRealDeviceAdapter({
    apiBase: 'https://api.example.test',
    getToken: () => 'pwa-token',
    timeoutMs: 5,
    fetch: async () => new Promise(() => {}),
  });

  await assert.rejects(adapter.fetchList(), (error) => error.type === 'timeout');
});
