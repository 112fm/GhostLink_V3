const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const {
  normalizeKeyLinks,
  resolveDefaultKeyApp,
  resolveKeyUrl,
} = require('../src/modules/key-app-choice.js');

const links = {
  url: 'vless://karing-key',
  url_incy: 'vless://incy-key',
};

test('normalizes only the two approved key link fields', () => {
  assert.deepEqual(normalizeKeyLinks({ ...links, token: 'do-not-copy' }), links);
  assert.deepEqual(normalizeKeyLinks(null), { url: '', url_incy: '' });
});

test('an explicit app selection stays authoritative', () => {
  assert.equal(resolveDefaultKeyApp({ preferredApp: 'karing', platform: 'ios', links }), 'karing');
  assert.equal(resolveDefaultKeyApp({ preferredApp: 'incy', platform: 'windows', links }), 'incy');
  assert.equal(resolveDefaultKeyApp({ preferredApp: 'incy', platform: 'windows', links: { url: links.url } }), 'incy');
});

test('mobile Apple and Android default to INCY while desktop-only platforms use Karing', () => {
  ['ios', 'macos', 'android', 'other'].forEach((platform) => {
    assert.equal(resolveDefaultKeyApp({ platform, links }), 'incy');
  });
  ['windows', 'linux', 'tv'].forEach((platform) => {
    assert.equal(resolveDefaultKeyApp({ platform, links }), 'karing');
  });
});

test('missing app link falls back to the available link without inventing data', () => {
  assert.equal(resolveDefaultKeyApp({ platform: 'ios', links: { url: links.url, url_incy: '' } }), 'karing');
  assert.equal(resolveDefaultKeyApp({ platform: 'windows', links: { url: '', url_incy: links.url_incy } }), 'incy');
  assert.equal(resolveDefaultKeyApp({ platform: 'ios', links: { url: '', url_incy: '' } }), null);
});

test('Karing resolves url and INCY resolves url_incy', () => {
  assert.equal(resolveKeyUrl(links, 'karing'), links.url);
  assert.equal(resolveKeyUrl(links, 'incy'), links.url_incy);
  assert.equal(resolveKeyUrl(links, 'unknown'), '');
});

test('app choice stays on page-app-select while the key modal remains clean', () => {
  const template = fs.readFileSync(path.join(root, 'src/templates/pages/devices.html'), 'utf8');

  assert.match(template, /id="page-app-select"/);
  assert.match(template, /name="app-choice" value="incy"/);
  assert.match(template, /name="app-choice" value="karing"/);
  assert.doesNotMatch(template, /key-app-picker|btn-key-app-karing|btn-key-app-incy/);
  assert.doesNotMatch(template, /qr-code|key-qr|Сгенерировать QR/i);
  assert.doesNotMatch(template, /vless:\/\/ghostlink-key/i);
});
