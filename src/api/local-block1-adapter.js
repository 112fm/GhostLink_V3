(function registerLocalBlock1Adapter(globalScope) {
  const TARIFFS = Object.freeze([
    Object.freeze({ id: 'solo-ghost', title: 'SOLO GHOST', deviceLimit: 2 }),
    Object.freeze({ id: 'flex-squad', title: 'FLEX SQUAD', deviceLimit: 5 }),
    Object.freeze({ id: 'vip-diamond', title: 'VIP DIAMOND', deviceLimit: 5 }),
  ]);

  const SCENARIOS = Object.freeze({
    trial: Object.freeze({ plan: 'solo-ghost', emoji: '👻', totalDays: 7, remainingDays: 7, deviceLimit: 2, usedDevices: 1 }),
    active: Object.freeze({ plan: 'vip-diamond', emoji: '💎', totalDays: 30, remainingDays: 29, deviceLimit: 5, usedDevices: 3 }),
    approved: Object.freeze({ plan: 'flex-squad', emoji: '✨', totalDays: 90, remainingDays: 90, deviceLimit: 3, usedDevices: 1 }),
    vip: Object.freeze({ plan: 'vip-diamond', emoji: '💎', totalDays: 365, remainingDays: 250, deviceLimit: 5, usedDevices: 4 }),
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createError(type, message, status) {
    const error = new Error(message);
    error.type = type;
    if (status) error.status = status;
    return error;
  }

  function createNormalSnapshot(mode) {
    const scenario = SCENARIOS[mode];
    const tariff = TARIFFS.find((item) => item.id === scenario.plan);
    return {
      profile: { id: `local-${mode}-user`, displayName: 'Тестовый пользователь', access: 'granted' },
      subscription: {
        state: mode,
        active: true,
        plan: { id: tariff.id, title: tariff.title, emoji: scenario.emoji },
        totalDays: scenario.totalDays,
        remainingDays: scenario.remainingDays,
        deviceLimit: scenario.deviceLimit,
        usedDevices: scenario.usedDevices,
      },
      tariffs: clone(TARIFFS),
    };
  }

  function createScenarioSnapshot(mode) {
    if (SCENARIOS[mode]) return createNormalSnapshot(mode);
    if (mode === 'pending') {
      return {
        profile: { id: 'local-pending-user', displayName: 'Тестовый пользователь', access: 'pending' },
        subscription: { state: 'pending', active: false, plan: null, totalDays: 0, remainingDays: 0, deviceLimit: 0, usedDevices: 0 },
        tariffs: clone(TARIFFS),
      };
    }
    if (mode === 'none' || mode === 'denied') {
      return {
        profile: { id: `local-${mode}-user`, displayName: 'Доступ ограничен', access: 'closed' },
        subscription: { state: mode, active: false, plan: null, totalDays: 0, remainingDays: 0, deviceLimit: 0, usedDevices: 0 },
        tariffs: clone(TARIFFS),
      };
    }
    return createNormalSnapshot('active');
  }

  function createLocalBlock1Adapter(options = {}) {
    let mode = options.mode || 'active';
    let inFlight = null;
    let session = null;
    let fetchCount = 0;

    function wait() {
      if (!options.delayMs) return Promise.resolve();
      return new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    function openSession() {
      session = Object.freeze({
        status: 'authenticated',
        transport: 'cookie',
        sessionId: `local-session-${mode}`,
      });
      return session;
    }

    function throwForMode() {
      if (mode === 'offline') throw createError('network', 'Локальный адаптер недоступен без сети.');
      if (mode === 'timeout') throw createError('timeout', 'Локальный адаптер превысил время ожидания.');
      if (mode === 'invalid-json') throw createError('invalid_json', 'Локальный адаптер получил повреждённые данные.');
      if (mode === 'unauthorized') throw createError('auth', 'Требуется повторный вход через Telegram.', 401);
      if (mode === 'forbidden') throw createError('auth', 'Доступ к профилю закрыт.', 403);
    }

    return Object.freeze({
      fetchProfileSubscription() {
        if (inFlight) return inFlight;

        fetchCount += 1;
        inFlight = wait().then(() => {
          throwForMode();
          return { session: openSession(), ...createScenarioSnapshot(mode) };
        }).finally(() => {
          inFlight = null;
        });
        return inFlight;
      },

      getSession: () => session ? { ...session } : null,
      getFetchCount: () => fetchCount,
      setMode: (nextMode) => { mode = nextMode; },
    });
  }

  const exported = { createLocalBlock1Adapter, localBlock1Scenarios: SCENARIOS, localBlock1Tariffs: TARIFFS };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    Object.assign(globalScope.GhostLinkV3, exported);
  }
})(typeof window !== 'undefined' ? window : globalThis);
