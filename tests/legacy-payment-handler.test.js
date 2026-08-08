const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'modules', 'admin', 'users.js'), 'utf8');
const output = fs.readFileSync(path.join(root, 'src', 'modules', 'admin.js'), 'utf8');

test('admin source and generated output contain no unreachable legacy payment detail handler', () => {
  for (const text of [source, output]) {
    assert.doesNotMatch(text, /\bopenPaymentDetailModal\b/);
    assert.doesNotMatch(text, /\bpayDetailContent\b/);
    assert.doesNotMatch(text, /\bmodalPaymentDetail\b/);
  }
});
