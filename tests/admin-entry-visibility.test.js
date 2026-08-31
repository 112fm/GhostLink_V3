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
    replaceChildren: function(...children) {
      this.children = [...children];
    },
    appendChild: function(child) {
      if (!this.children) this.children = [];
      this.children.push(child);
      return child;
    },
    append: function(...children) {
      if (!this.children) this.children = [];
      this.children.push(...children);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

test('updateAdminSettingsVisibility shows #btnSettingsAdmin only for an explicit user.is_admin true', () => {
  const btn = createMockElement('btnSettingsAdmin');
  const mockDoc = {
    getElementById: (id) => (id === 'btnSettingsAdmin' ? btn : null),
  };

  // user.is_admin: true
  updateAdminSettingsVisibility({ user: { is_admin: true } }, mockDoc);
  assert.equal(btn.style.display, 'flex');

  // Legacy profile aliases must not expose the admin entry.
  btn.style.display = 'none';
  updateAdminSettingsVisibility({ profile: { isAdmin: true } }, mockDoc);
  assert.equal(btn.style.display, 'none');

  // Truthy non-boolean values are also denied.
  updateAdminSettingsVisibility({ user: { is_admin: 'true' } }, mockDoc);
  assert.equal(btn.style.display, 'none');
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

test('clicking #btnSettingsAdmin opens #page-admin-dashboard and #btnAdminBack closes it', async () => {
  const elements = new Map();
  function getOrCreateElement(id) {
    if (!elements.has(id)) {
      elements.set(id, createMockElement(id));
    }
    return elements.get(id);
  }

  const btnSettingsAdmin = getOrCreateElement('btnSettingsAdmin');
  const pageAdminDashboard = getOrCreateElement('page-admin-dashboard');
  const btnAdminBack = getOrCreateElement('btnAdminBack');
  getOrCreateElement('btnAdminRefresh');

  const mockDoc = {
    readyState: 'complete',
    getElementById: (id) => getOrCreateElement(id),
    createElement: (tag) => createMockElement('', tag),
    createDocumentFragment: () => createMockElement('', 'fragment'),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
  };

  global.document = mockDoc;
  global.location = { protocol: 'file:' };
  global.window = {
    document: mockDoc,
    location: { protocol: 'file:' },
    GhostLinkV3: {},
    addEventListener: () => {},
  };

  require(path.join(root, 'src', 'mocks', 'admin-security.js'));

  let overlayOpened = null;
  let overlayClosed = null;

  // Load and init admin module
  require(path.join(root, 'src', 'modules', 'admin.js'));
  global.window.GhostLinkV3.initAdminModule({
    showToast: () => {},
    copyText: () => true,
    openOverlay: (page) => {
      overlayOpened = page;
      page?.classList?.add('active');
    },
    closeOverlay: (page) => {
      overlayClosed = page;
      page?.classList?.remove('active');
    },
    profileSubscription: {
      getCachedProfile: () => ({ user: { is_admin: true } }),
    },
    returnToHome: () => {},
  });

  // Verify pageAdminDashboard was NOT removed from DOM
  assert.equal(pageAdminDashboard.removed, undefined);

  // Click #btnSettingsAdmin
  await btnSettingsAdmin.click();

  // Verify pageAdminDashboard received openOverlay and .active class
  assert.equal(overlayOpened, pageAdminDashboard);
  assert.equal(pageAdminDashboard.classList.contains('active'), true);

  // Click #btnAdminBack
  await btnAdminBack.click();

  // Verify pageAdminDashboard received closeOverlay and removed .active class
  assert.equal(overlayClosed, pageAdminDashboard);
  assert.equal(pageAdminDashboard.classList.contains('active'), false);
});
