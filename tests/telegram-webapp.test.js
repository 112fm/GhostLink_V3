const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { initTelegramWebApp } = require(path.join(root, 'src', 'ui', 'telegram-webapp.js'));

test('Telegram bootstrap safely calls ready and expand before Block 1 reads initData', () => {
  const calls = [];
  const webApp = {
    ready: () => calls.push('ready'),
    expand: () => calls.push('expand'),
    initData: 'telegram-init-data',
  };

  assert.equal(initTelegramWebApp({ Telegram: { WebApp: webApp } }), webApp);
  assert.deepEqual(calls, ['ready', 'expand']);
});

test('Telegram bootstrap is safe outside Telegram or when SDK methods fail', () => {
  assert.equal(initTelegramWebApp({}), null);
  assert.doesNotThrow(() => initTelegramWebApp({
    Telegram: { WebApp: { ready: () => { throw new Error('blocked'); }, expand: () => { throw new Error('blocked'); } } },
  }));
});

test('V3 loads the official SDK before its real Block 1 boot graph', () => {
  const template = fs.readFileSync(path.join(root, 'src', 'templates', 'index.template.html'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

  const sdk = template.indexOf('https://telegram.org/js/telegram-web-app.js');
  const bootstrap = template.indexOf('src/ui/telegram-webapp.js');
  const adapter = template.indexOf('src/api/real-block1-adapter.js');

  assert.ok(sdk >= 0 && sdk < bootstrap && bootstrap < adapter);
  assert.match(main, /initTelegramWebApp/);
  assert.ok(main.indexOf('initTelegramWebApp') < main.indexOf('createRealBlock1Adapter'));
  assert.doesNotMatch(main, /initDataUnsafe/);
});
