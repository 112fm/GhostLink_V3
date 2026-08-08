const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const { createMockSupport } = require('../src/mocks/support.js');

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('empty support message creates neither a topic nor a message', async () => {
  const support = createMockSupport();
  const result = await support.sendMessage({ request_id: 'empty-support', message: '   ' });

  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'bad_request');
  assert.equal(support.getCreateCount(), 0);
  assert.equal(await support.getLatestTopic(), null);
});

test('first message opens one topic and later messages stay in it', async () => {
  const support = createMockSupport({ now: () => 1_760_000_000_000 });
  const first = await support.sendMessage({ request_id: 'support-first', message: 'Не подключается приложение.' });
  const second = await support.sendMessage({ request_id: 'support-second', message: 'Проверил сеть, но не помогло.' });
  const topic = await support.getTopic(first.topic_id);

  assert.equal(first.topic_status, 'open');
  assert.equal(second.topic_id, first.topic_id);
  assert.equal(topic.messages.length, 2);
  assert.deepEqual(topic.messages.map((item) => item.author), ['client', 'client']);
  assert.equal(support.getCreateCount(), 2);
});

test('same message request_id is idempotent and rapid retry creates no duplicate message', async () => {
  const support = createMockSupport();
  const first = await support.sendMessage({ request_id: 'support-once', message: 'Нужна помощь' });
  const retry = await support.sendMessage({ request_id: 'support-once', message: 'Другой текст не должен заменить первый' });
  const topic = await support.getTopic(first.topic_id);

  assert.deepEqual(retry, first);
  assert.equal(topic.messages.length, 1);
  assert.equal(support.getCreateCount(), 1);
});

test('admin reply is added to the same open topic', async () => {
  const support = createMockSupport();
  const sent = await support.sendMessage({ request_id: 'support-admin-reply', message: 'Нужна инструкция.' });
  const topic = await support.addMockAdminReply(sent.topic_id, 'Откройте настройку ключа и выберите устройство.');

  assert.equal(topic.status, 'open');
  assert.deepEqual(topic.messages.map((item) => item.author), ['client', 'admin']);
  assert.equal(topic.messages[1].text, 'Откройте настройку ключа и выберите устройство.');
});

test('closing a topic preserves history and appends a client-visible system message', async () => {
  const support = createMockSupport();
  const sent = await support.sendMessage({ request_id: 'support-close', message: 'Спасибо, всё работает.' });
  await support.addMockAdminReply(sent.topic_id, 'Рады помочь.');
  const closed = await support.closeTopic(sent.topic_id);

  assert.equal(closed.status, 'closed');
  assert.equal(closed.messages.length, 3);
  assert.equal(closed.messages.at(-1).author, 'system');
  assert.match(closed.messages.at(-1).text, /Тему закрыли/);
  assert.equal((await support.getTopic(sent.topic_id)).messages.length, 3);
  assert.equal(await support.addMockAdminReply(sent.topic_id, 'Скрытый ответ'), null);
});

test('a message after close opens a new topic and does not rewrite the closed one', async () => {
  const support = createMockSupport();
  const first = await support.sendMessage({ request_id: 'support-old-topic', message: 'Первая тема' });
  await support.closeTopic(first.topic_id);
  const second = await support.sendMessage({ request_id: 'support-new-topic', message: 'Новая проблема' });

  assert.notEqual(second.topic_id, first.topic_id);
  assert.equal((await support.getTopic(first.topic_id)).status, 'closed');
  assert.equal((await support.getTopic(second.topic_id)).status, 'open');
  assert.equal((await support.getTopic(second.topic_id)).messages.length, 1);
});

test('history and closed status are restored after reopening the Mini App', async () => {
  const storage = createMemoryStorage();
  const beforeReload = createMockSupport({ storage });
  const sent = await beforeReload.sendMessage({ request_id: 'support-restore', message: 'Сообщение до перезапуска' });
  await beforeReload.addMockAdminReply(sent.topic_id, 'Ответ до перезапуска');
  await beforeReload.closeTopic(sent.topic_id);

  const afterReload = createMockSupport({ storage });
  const restored = await afterReload.getLatestTopic();
  assert.equal(restored.topic_id, sent.topic_id);
  assert.equal(restored.status, 'closed');
  assert.deepEqual(restored.messages.map((item) => item.author), ['client', 'admin', 'system']);
});

test('timeout and offline preserve the same message request_id for a safe retry', async () => {
  const storage = createMemoryStorage();
  const support = createMockSupport({ storage });
  await assert.rejects(
    support.sendMessage({ request_id: 'support-timeout', message: 'Проверка timeout', scenario: 'timeout' }),
    (error) => error.type === 'timeout' && error.request_id === 'support-timeout',
  );
  const recovered = await createMockSupport({ storage }).sendMessage({ request_id: 'support-timeout', message: 'Проверка timeout' });
  assert.equal((await createMockSupport({ storage }).getTopic(recovered.topic_id)).messages.length, 1);

  const offline = createMockSupport({ storage, online: false });
  await assert.rejects(
    offline.sendMessage({ request_id: 'support-offline', message: 'Проверка offline' }),
    (error) => error.type === 'network',
  );
  offline.setOnline(true);
  const latest = await offline.getLatestTopic();
  assert.equal(latest.messages.at(-1).request_id, 'support-offline');
});

test('long text and special characters remain text data, not executable markup', async () => {
  const support = createMockSupport();
  const message = `<script>alert('x')</script> & Привет\n${'длинный текст '.repeat(120)}`;
  const result = await support.sendMessage({ request_id: 'support-safe-text', message });

  assert.equal(result.message, message.trim());
  assert.match(result.message, /<script>/);
  assert.ok(result.message.length > 1000);
});

test('support UI uses the local topic adapter and safe text rendering only', () => {
  const moduleSource = readFileSync(join(__dirname, '..', 'src', 'modules', 'support.js'), 'utf8');
  const legacySource = readFileSync(join(__dirname, '..', 'src', 'modules', 'admin', 'support.js'), 'utf8');

  assert.match(moduleSource, /sendMessage/);
  assert.match(moduleSource, /getLatestTopic/);
  assert.match(moduleSource, /text\.textContent = message\.text/);
  assert.doesNotMatch(moduleSource, /fetch\s*\(/);
  assert.doesNotMatch(moduleSource, /Telegram\.WebApp/);
  assert.match(legacySource, /dataset\.supportRuntime/);
});
