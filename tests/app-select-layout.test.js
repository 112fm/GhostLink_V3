const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const css = readFileSync(join(root, 'src/css/page-app-select.css'), 'utf8');

test('app selection keeps mobile actions fixed but releases them on desktop', () => {
  const mobileBar = css.match(/\.app-select-bottom-bar\s*\{([\s\S]*?)\n\}/);

  assert.ok(mobileBar);
  assert.match(mobileBar[1], /position:\s*absolute/);
  assert.match(css, /@media \(min-width: 600px\)[\s\S]*?#page-app-select\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /@media \(min-width: 600px\)[\s\S]*?\.app-select-bottom-bar\s*\{[\s\S]*?position:\s*static/);
});
