const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { loadTelegramSdk } = require(path.join(root, 'src', 'ui', 'telegram-sdk-loader.js'));

function createScriptDocument() {
  const scripts = [];
  return {
    scripts,
    createElement() {
      return {
        async: false,
        remove() {},
      };
    },
    head: {
      append(script) {
        scripts.push(script);
      },
    },
  };
}

test('uses the already available official Telegram SDK without adding another script', async () => {
  const scope = { Telegram: { WebApp: { initData: 'safe-init-data' } } };
  const documentRef = createScriptDocument();

  const result = await loadTelegramSdk({ scope, documentRef });

  assert.equal(result.source, 'existing');
  assert.equal(documentRef.scripts.length, 0);
});

test('loads the checked local SDK when telegram.org fails', async () => {
  const scope = {};
  const documentRef = createScriptDocument();
  const promise = loadTelegramSdk({ scope, documentRef, timeoutMs: 1000 });

  assert.equal(documentRef.scripts.length, 1);
  assert.match(documentRef.scripts[0].src, /https:\/\/telegram\.org\/js\/telegram-web-app\.js/);
  documentRef.scripts[0].onerror();

  assert.equal(documentRef.scripts.length, 2);
  assert.match(documentRef.scripts[1].src, /\.\/src\/vendor\/telegram-web-app\.js\?v=26/);
  scope.Telegram = { WebApp: { initData: 'safe-init-data' } };
  documentRef.scripts[1].onload();

  assert.deepEqual(await promise, { source: 'fallback', ready: true });
});

test('loads the local SDK after a bounded wait when telegram.org hangs', async () => {
  const scope = {};
  const documentRef = createScriptDocument();
  let fireTimeout;
  const promise = loadTelegramSdk({
    scope,
    documentRef,
    timeoutMs: 1000,
    setTimeoutImpl: (callback) => {
      fireTimeout = callback;
      return 1;
    },
    clearTimeoutImpl: () => {},
  });

  assert.equal(documentRef.scripts.length, 1);
  fireTimeout();
  assert.equal(documentRef.scripts.length, 2);
  scope.Telegram = { WebApp: { initData: 'safe-init-data' } };
  documentRef.scripts[1].onload();

  assert.deepEqual(await promise, { source: 'fallback', ready: true });
});

test('falls back when the external SDK loads but does not expose Telegram.WebApp', async () => {
  const scope = {};
  const documentRef = createScriptDocument();
  const promise = loadTelegramSdk({ scope, documentRef, timeoutMs: 1000 });

  documentRef.scripts[0].onload();
  assert.equal(documentRef.scripts.length, 2);
  scope.Telegram = { WebApp: { initData: 'safe-init-data' } };
  documentRef.scripts[1].onload();

  assert.deepEqual(await promise, { source: 'fallback', ready: true });
});
