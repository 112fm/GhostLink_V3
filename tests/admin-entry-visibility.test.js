const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { updateAdminSettingsVisibility, initHomeModule } = require(path.join(root, 'src', 'modules', 'home.js'));

function createMockElement(id = '', tagName = 'div') {
  const listeners = new Map();
  const classes = new Set();
  const dataset = {};
  let value = '';
  let textContent = '';
  let style = { display: 'none' };

  return {
    id,
    tagName: tagName.toUpperCase(),
    dataset,
    style,
    disabled: false,
    classList: {
      add: (...names) => names.forEach(n => classes.add(n)),
      remove: (...names) => names.forEach(n => classes.delete(n)),
      toggle: (name, force) => {
        if (force === undefined) {
          if (classes.has(name)) { classes.delete(name); return false; }
          classes.add(name); return true;
        }
        if (force) { classes.add(name); return true; }
        classes.delete(name); return false;
      },
      contains: (name) => classes.has(name),
    },
    addEventListener: (event, handler) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(handler);
    },
    dispatchEvent: async (event) => {
      const handlers = listeners.get(event?.type || event) || [];
      for (const handler of handlers) {
        await handler(event);
      }
    },
    click: async function() {
      await this.dispatchEvent({ type: 'click', preventDefault: () => {} });
    },
    remove: function() {
      this.removed = true;
    },
  };
}

test('updateAdminSettingsVisibility shows #btnSettingsAdmin for admin profiles', () => {
  const btn = createMockElement('btnSettingsAdmin');
  const mockDoc = {
    getElementById: (id) => (id === 'btnSettingsAdmin' ? btn : null),
  };

  // user.is_admin: true
  updateAdminSettingsVisibility({ user: { is_admin: true } }, mockDoc);
  assert.equal(btn.style.display, 'flex');

  // profile.isAdmin: true
  updateAdminSettingsVisibility({ profile: { isAdmin: true } }, mockDoc);
  assert.equal(btn.style.display, 'flex');

  // profile.is_admin: true
  updateAdminSettingsVisibility({ profile: { is_admin: true } }, mockDoc);
  assert.equal(btn.style.display, 'flex');
});

test('updateAdminSettingsVisibility hides #btnSettingsAdmin for non-admin profiles or errors', () => {
  const btn = createMockElement('btnSettingsAdmin');
  btn.style.display = 'flex';
  const mockDoc = {
    getElementById: (id) => (id === 'btnSettingsAdmin' ? btn : null),
  };

  // regular user
  updateAdminSettingsVisibility({ user: { is_admin: false }, profile: { isAdmin: false } }, mockDoc);
  assert.equal(btn.style.display, 'none');

  // error or null snapshot
  btn.style.display = 'flex';
  updateAdminSettingsVisibility(null, mockDoc);
  assert.equal(btn.style.display, 'none');

  btn.style.display = 'flex';
  updateAdminSettingsVisibility({ error: new Error('Failed to load') }, mockDoc);
  assert.equal(btn.style.display, 'none');
});
