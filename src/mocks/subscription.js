(function registerMockProfileSubscription(globalScope) {
  const SCENARIOS = Object.freeze({
    active: Object.freeze({
      profile: Object.freeze({ id: 'mock-user-active', displayName: 'Тестовый пользователь' }),
      subscription: Object.freeze({
        state: 'active', active: true, plan: Object.freeze({ id: 'vip-diamond', title: 'VIP DIAMOND', emoji: '💎' }),
        totalDays: 30, remainingDays: 29, deviceLimit: 5, usedDevices: 3,
      }),
    }),
    'low-days': Object.freeze({
      profile: Object.freeze({ id: 'mock-user-low-days', displayName: 'Тестовый пользователь' }),
      subscription: Object.freeze({
        state: 'active', active: true, plan: Object.freeze({ id: 'solo-ghost', title: 'SOLO GHOST', emoji: '👻' }),
        totalDays: 30, remainingDays: 6, deviceLimit: 2, usedDevices: 1,
      }),
    }),
    expired: Object.freeze({
      profile: Object.freeze({ id: 'mock-user-expired', displayName: 'Тестовый пользователь' }),
      subscription: Object.freeze({
        state: 'expired', active: false, plan: null,
        totalDays: 30, remainingDays: 0, deviceLimit: 0, usedDevices: 0,
      }),
    }),
    'new-user': Object.freeze({
      profile: Object.freeze({ id: 'mock-user-new', displayName: 'Новый пользователь' }),
      subscription: Object.freeze({
        state: 'new', active: false, plan: null,
        totalDays: 0, remainingDays: 0, deviceLimit: 0, usedDevices: 0,
      }),
    }),
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createMockProfileSubscription(options = {}) {
    let mode = options.mode || 'active';
    let inFlight = null;
    let fetchCount = 0;

    function wait() {
      if (!options.delayMs) return Promise.resolve();
      return new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    return Object.freeze({
      fetchProfileSubscription() {
        if (inFlight) return inFlight;

        fetchCount += 1;
        inFlight = wait().then(() => {
          if (mode === 'offline' || mode === 'timeout') {
            const error = new Error(mode === 'timeout' ? 'Mock profile request timed out.' : 'Mock profile is offline.');
            error.type = mode === 'timeout' ? 'timeout' : 'network';
            throw error;
          }

          return clone(SCENARIOS[mode] || SCENARIOS.active);
        }).finally(() => {
          inFlight = null;
        });
        return inFlight;
      },

      setMode(nextMode) {
        mode = nextMode;
      },

      getFetchCount: () => fetchCount,
    });
  }

  const exported = { createMockProfileSubscription, profileSubscriptionScenarios: SCENARIOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    globalScope.GhostLinkV3.createMockProfileSubscription = createMockProfileSubscription;
    globalScope.GhostLinkV3.mockSubscription = SCENARIOS.active.subscription;
  }
})(typeof window !== 'undefined' ? window : globalThis);
