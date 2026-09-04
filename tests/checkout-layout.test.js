const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const css = readFileSync(join(root, 'src/css/page-checkout.css'), 'utf8');
const template = readFileSync(join(root, 'src/templates/pages/checkout.html'), 'utf8');
const subscription = readFileSync(join(root, 'src/modules/subscription.js'), 'utf8');
const contextHelpCss = readFileSync(join(root, 'src/css/context-help.css'), 'utf8');

test('checkout uses one dedicated scroll container for the payment form', () => {
  const checkoutRule = css.match(/#page-checkout\s*\{([\s\S]*?)\n\}/);
  const contentRule = css.match(/\.checkout-page-content\s*\{([\s\S]*?)\n\}/);

  assert.ok(checkoutRule);
  assert.match(checkoutRule[1], /overflow:\s*hidden/);
  assert.ok(contentRule);
  assert.match(contentRule[1], /overflow-y:\s*auto/);
});

test('checkout has a dedicated mobile action bar and releases it on desktop', () => {
  assert.match(template, /class="checkout-action-bar"/);
  assert.match(css, /\.checkout-action-bar\s*\{[\s\S]*?position:\s*sticky[\s\S]*?bottom:/);
  assert.match(css, /@media \(min-width: 600px\)[\s\S]*?\.checkout-action-bar\s*\{[\s\S]*?position:\s*static/);
});

test('checkout help is placed in topbar flow and hidden when overlay is active', () => {
  const helpRule = contextHelpCss.match(/\.context-help-trigger\s*\{([\s\S]*?)\n\}/);

  assert.ok(helpRule);
  assert.match(helpRule[1], /position:\s*relative/);
  assert.match(contextHelpCss, /body:has\(\.page-overlay:not\(\.hidden\)\)\s*#helpButton/);
  assert.match(contextHelpCss, /display:\s*none\s*!important/);
});

test('receipt states lock checkout scrolling and keep the return button at the bottom', () => {
  assert.match(subscription, /pageCheckout\.dataset\.checkoutView\s*=\s*state/);
  assert.match(css, /#page-checkout\[data-checkout-view="pending"\],[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /#page-checkout\[data-checkout-view="pending"\][\s\S]*?\.pending-layout\s*\{[\s\S]*?flex:\s*1/);
  assert.match(css, /#page-checkout\[data-checkout-view="pending"\][\s\S]*?\.pending-home-button\s*\{[\s\S]*?margin-top:\s*auto/);
});
