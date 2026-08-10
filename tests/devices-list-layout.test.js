const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const template = readFileSync(join(root, 'src/templates/pages/devices.html'), 'utf8');
const css = readFileSync(join(root, 'src/css/page-settings.css'), 'utf8');

test('device list header reserves the fixed help area without inline positioning', () => {
  assert.match(template, /<header class="page-header devices-list-header">/);
  assert.doesNotMatch(template, /id="page-devices-list"[\s\S]*?justify-content:\s*space-between/);
  assert.match(css, /\.devices-list-header\s*\{[\s\S]*?justify-content:\s*flex-start/);
  assert.match(css, /@media \(min-width: 600px\)[\s\S]*?\.devices-list-header\s*\{[\s\S]*?padding-right:\s*110px/);
});
