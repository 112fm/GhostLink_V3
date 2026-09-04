(() => {
const GhostLinkV3 = window.GhostLinkV3 = window.GhostLinkV3 || {};

function createRouter({ initialRoute = "home" } = {}) {
  const history = [initialRoute];
  const listeners = new Set();

  function notify() {
    listeners.forEach((listener) => listener(history.at(-1)));
  }

  return {
    current: () => history.at(-1),
    go(route) {
      if (!route || route === history.at(-1)) return;
      history.push(route);
      notify();
    },
    back() {
      if (history.length > 1) history.pop();
      notify();
    },
    reset(route = initialRoute) {
      history.splice(0, history.length, route);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function createOverlayNavigator({ selector = ".page-overlay" } = {}) {
  const stack = [];

  function syncOverlayBodyState() {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('has-overlay-open', stack.length > 0);
    }
  }

  return {
    open(page) {
      if (!page || stack.at(-1) === page) return;
      stack.at(-1)?.classList.add("hidden");
      stack.push(page);
      page.classList.remove("hidden");
      syncOverlayBodyState();
    },
    close(page) {
      if (!page) return;
      const index = stack.lastIndexOf(page);
      if (index === -1) {
        page.classList.add("hidden");
        syncOverlayBodyState();
        return;
      }

      const wasCurrent = index === stack.length - 1;
      stack.splice(index, 1);
      page.classList.add("hidden");
      if (wasCurrent) stack.at(-1)?.classList.remove("hidden");
      syncOverlayBodyState();
    },
    home() {
      stack.splice(0).forEach((page) => page.classList.add("hidden"));
      document.querySelectorAll(selector).forEach((page) => page.classList.add("hidden"));
      syncOverlayBodyState();
    },
  };
}

Object.assign(GhostLinkV3, { createRouter, createOverlayNavigator });
})();
