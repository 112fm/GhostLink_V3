const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const { createRealDeviceAdapter } = require(join(root, 'src/api/real-device-adapter.js'));
const devicesSource = readFileSync(join(root, 'src/modules/devices.js'), 'utf8');

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

test('HTTP rollback errors are translated before they reach the devices screen', async () => {
  const adapter = createRealDeviceAdapter({
    apiBase: 'https://api.example.test',
    getToken: () => 'session',
    fetch: async () => response(502, { detail: 'partial_failure_restored' }),
  });

  await assert.rejects(
    adapter.fetchList(),
    (error) => error.message === 'Не удалось завершить операцию. Исходное состояние устройства восстановлено.',
  );
});

test('HTTP delete rollback errors have a clear Russian message', async () => {
  const adapter = createRealDeviceAdapter({
    apiBase: 'https://api.example.test',
    getToken: () => 'session',
    fetch: async () => response(409, { detail: 'device_delete_rolled_back' }),
  });

  await assert.rejects(
    adapter.start({ requestId: '00000000-0000-4000-8000-000000000001', type: 'remove', deviceId: 'device-a' }),
    (error) => error.message === 'Удаление не завершено. Устройство восстановлено и остаётся в списке.',
  );
});

test('confirmed remove updates the local snapshot even when the adapter has no applyMutation method', () => {
  assert.match(devicesSource, /function applyMutationToSnapshot\(/);
  assert.match(devicesSource, /const optimisticSnapshot = applyMutationToSnapshot\(lastConfirmedDeviceList, result\);/);
  assert.doesNotMatch(devicesSource, /const applied = deviceList\?\.applyMutation\?\.\(result\);\s*if \(applied\) \{\s*const optimisticSnapshot/);
});

test('legacy names are never used to silently select the first device', () => {
  assert.match(devicesSource, /function isLegacyDeviceName\(/);
  assert.doesNotMatch(devicesSource, /const matched = existingDevices\.find\(\(d\) => isDeviceCurrentForPlatform\(d, curPlatform\)\) \|\| existingDevices\[0\]/);
  assert.match(devicesSource, /Выберите нужное устройство из списка/);
});

test('a repeated setup click reuses the in-flight creation instead of creating a second request id', () => {
  assert.match(devicesSource, /function createSetupDevice\(payload\) \{\s*if \(setupCreatePromise\) return setupCreatePromise;/);
  assert.match(devicesSource, /setupCreatePromise = deviceOperations\.createDevice\(\{ requestId, \.\.\.payload \}\)/);
});

test('device picker is rendered from confirmed device cards before a new-device platform choice', () => {
  const html = readFileSync(join(root, 'src/templates/pages/devices.html'), 'utf8');
  assert.match(html, /id="other-device-picker-list"/);
  assert.match(html, /id="other-device-add-new"/);
  assert.match(devicesSource, /function renderOtherDevicePicker\(/);
  assert.match(devicesSource, /renderOtherDevicePicker\(lastConfirmedDeviceList\?\.devices \|\| \[\]\)/);
});
