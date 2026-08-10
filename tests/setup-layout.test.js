const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const css = readFileSync(join(root, 'src/css/page-setup.css'), 'utf8');

test('setup keeps its fixed mobile action bar but lets desktop content flow and scroll', () => {
  const mobileBar = css.match(/\.setup-bottom-bar\s*\{([\s\S]*?)\n\}/);

  assert.ok(mobileBar);
  assert.match(mobileBar[1], /position:\s*absolute/);
  assert.match(css, /@media \(min-width: 600px\)[\s\S]*?\.setup-bottom-bar\s*\{[\s\S]*?position:\s*static/);
  assert.match(css, /@media \(min-width: 600px\)[\s\S]*?#page-setup\s*\{[\s\S]*?overflow-y:\s*auto/);
});
