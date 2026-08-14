(function registerRealBlock1Adapter(globalScope) {
  const DEFAULT_API_BASE = 'https://api.112prd.ru';
  const DEFAULT_TOTAL_TIMEOUT_MS = 10000;
  const DEFAULT_INIT_DATA_WAIT_MS = 3000;
  const INIT_DATA_RETRY_MS = 150;

  function createError(type, message, status, data) {
    const error = new Error(message || type);
    error.type = type;
    if (status) error.status = status;
    if (data !== undefined) error.data = data;
    return error;
  }

  function normaliseApiBase(value) {
    return String(value || DEFAULT_API_BASE).replace(/\/+$/, '');
  }

  function toInteger(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
  }

  function daysUntil(expiry, now) {
    if (!expiry) return null;
    const end = new Date(`${expiry}T23:59:59Z`);
    if (Number.isNaN(end.getTime())) return null;
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / 86400000));
  }

  async function requestJson(fetchImpl, url, options, timeoutMs) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timedOut = false;
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = globalScope.setTimeout(() => {
        timedOut = true;
        controller?.abort();
        reject(createError('timeout', 'Сервер отвечает слишком долго. Попробуйте ещё раз.'));
      }, Math.max(1, timeoutMs));
    });

    try {
      const response = await Promise.race([
        fetchImpl(url, { ...options, signal: controller?.signal }),
        timeoutPromise,
      ]);
      const raw = await Promise.race([response.text(), timeoutPromise]);
      let data;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (_) {
        throw createError('invalid_json', 'Сервер вернул некорректные данные.', response.status);
      }

      if (response.status === 401 || response.status === 403) {
        throw createError('auth', data?.detail || 'Требуется открыть Mini App через Telegram.', response.status, data);
      }
      if (!response.ok) {
        throw createError('api', data?.detail || `api_error_${response.status}`, response.status, data);
      }
      if (!data || typeof data !== 'object') {
        throw createError('invalid_json', 'Сервер вернул пустой ответ.', response.status);
      }
      return data;
    } catch (error) {
      if (error?.type) throw error;
      if (timedOut || error?.name === 'AbortError') {
        throw createError('timeout', 'Сервер отвечает слишком долго. Попробуйте ещё раз.');
      }
      throw createError('network', 'Не удалось связаться с GhostLink. Проверьте подключение.');
    } finally {
      if (timeoutId) globalScope.clearTimeout(timeoutId);
    }
  }

  function getErrorStatus(error) {
    if (Number.isFinite(Number(error?.status))) return Number(error.status);
    return error?.type || 'error';
  }

  function mapProfile(userResponse, tariffsResponse, now) {
    const user = userResponse?.user;
    const subscription = userResponse?.subscription;
    if (!user || !subscription || typeof subscription !== 'object') {
      throw createError('invalid_json', 'Профиль получен в неполном формате.');
    }

    const remainingDays = subscription.days_left === null || subscription.days_left === undefined
      ? daysUntil(subscription.expiry, now)
      : toInteger(subscription.days_left);
    const active = Boolean(subscription.active) && remainingDays !== null && remainingDays > 0;
    const status = String(subscription.status || '').toLowerCase();
    const state = status === 'pending' ? 'pending' : (active ? (status || 'active') : 'expired');
    const totalDays = subscription.total_days === null || subscription.total_days === undefined
      ? null
      : toInteger(subscription.total_days);

    return {
      isMock: false,
      profile: {
        id: String(user.id || ''),
        displayName: String(user.name || user.username || ''),
        access: active ? 'granted' : state,
      },
      subscription: {
        state,
        active,
        plan: {
          id: String(userResponse.tariff_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          title: String(userResponse.tariff_name || 'GHOSTLINK').toUpperCase(),
          emoji: '👻',
        },
        totalDays,
        remainingDays,
        expiry: subscription.expiry || null,
        deviceLimit: toInteger(userResponse.device_limit),
        usedDevices: toInteger(userResponse.connected_devices),
      },
      tariffs: tariffsResponse,
    };
  }

  function createRealBlock1Adapter(options = {}) {
    const apiBase = normaliseApiBase(options.apiBase);
    const fetchImpl = options.fetch || globalScope.fetch?.bind(globalScope);
    const getInitData = options.getInitData || (() => globalScope.Telegram?.WebApp?.initData || '');
    const now = options.now || (() => new Date());
    const nowMs = options.nowMs || (() => Date.now());
    const sleep = options.sleep || ((duration) => new Promise((resolve) => globalScope.setTimeout(resolve, duration)));
    const totalTimeoutMs = toInteger(options.totalTimeoutMs ?? options.timeoutMs, DEFAULT_TOTAL_TIMEOUT_MS) || DEFAULT_TOTAL_TIMEOUT_MS;
    const initDataWaitMs = Math.min(
      toInteger(options.initDataWaitMs, DEFAULT_INIT_DATA_WAIT_MS),
      totalTimeoutMs,
    );
    let token = '';
    let inFlight = null;
    let sessionState = null;
    let diagnostics = null;

    if (typeof fetchImpl !== 'function') {
      throw createError('network', 'Браузер не поддерживает сетевые запросы.');
    }

    function createDiagnostics() {
      return {
        initData_present: false,
        session_status: 'not_started',
        user_status: 'not_started',
        tariffs_status: 'not_started',
        durations_ms: {},
      };
    }

    function remainingTime(deadlineAt) {
      return Math.max(0, deadlineAt - nowMs());
    }

    async function waitForInitData(deadlineAt) {
      const initDataDeadline = Math.min(deadlineAt, nowMs() + initDataWaitMs);

      while (nowMs() < initDataDeadline) {
        const initData = String(getInitData() || '').trim();
        if (initData) {
          diagnostics.initData_present = true;
          return initData;
        }
        await sleep(Math.max(1, Math.min(INIT_DATA_RETRY_MS, initDataDeadline - nowMs())));
      }

      const initData = String(getInitData() || '').trim();
      if (initData) {
        diagnostics.initData_present = true;
        return initData;
      }
      throw createError('auth', 'Telegram ещё не передал данные входа. Закройте и откройте Mini App ещё раз.', 401);
    }

    async function runStage(name, deadlineAt, request, stageDiagnostics = diagnostics) {
      const startedAt = nowMs();
      try {
        const remaining = remainingTime(deadlineAt);
        if (remaining <= 0) throw createError('timeout', 'Загрузка заняла слишком долго. Попробуйте ещё раз.');
        const result = await request(remaining);
        stageDiagnostics[`${name}_status`] = 200;
        return result;
      } catch (error) {
        stageDiagnostics[`${name}_status`] = getErrorStatus(error);
        throw error;
      } finally {
        stageDiagnostics.durations_ms[name] = Math.max(0, nowMs() - startedAt);
      }
    }

    async function openSession(deadlineAt) {
      const initData = await waitForInitData(deadlineAt);

      const session = await runStage('session', deadlineAt, (timeoutMs) => requestJson(fetchImpl, `${apiBase}/api/miniapp/session`, {
          method: 'POST',
          cache: 'no-store',
          credentials: 'include',
          headers: { Accept: 'application/json' },
          body: new URLSearchParams({ init_data: initData }),
        }, timeoutMs));
      token = String(session.session_token || '');
      if (!token) throw createError('invalid_json', 'Сервер не подтвердил сессию.');
      sessionState = Object.freeze({ status: 'authenticated', transport: 'memory' });
    }

    function readHeaders() {
      return { Accept: 'application/json', 'X-PWA-Token': token };
    }

    return Object.freeze({
      fetchProfileSubscription() {
        if (inFlight) return inFlight;
        inFlight = (async () => {
          diagnostics = createDiagnostics();
          const requestDiagnostics = diagnostics;
          const deadlineAt = nowMs() + totalTimeoutMs;
          await openSession(deadlineAt);

          // The home island needs only the user profile. Tariff catalog loading is
          // diagnostic/background work and must not hide the current subscription.
          void runStage('tariffs', deadlineAt, (timeoutMs) => requestJson(fetchImpl, `${apiBase}/api/tariffs`, {
            method: 'GET', cache: 'no-store', credentials: 'include', headers: readHeaders(),
          }, timeoutMs), requestDiagnostics).catch(() => null);

          const user = await runStage('user', deadlineAt, (timeoutMs) => requestJson(fetchImpl, `${apiBase}/api/user`, {
            method: 'GET', cache: 'no-store', credentials: 'include', headers: readHeaders(),
          }, timeoutMs), requestDiagnostics);
          return mapProfile(user, null, now());
        })().finally(() => {
          inFlight = null;
        });
        return inFlight;
      },
      getSession: () => sessionState ? { ...sessionState } : null,
      getDiagnostics: () => diagnostics ? {
        ...diagnostics,
        durations_ms: { ...diagnostics.durations_ms },
      } : null,
    });
  }

  const exported = { createRealBlock1Adapter };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    Object.assign(globalScope.GhostLinkV3, exported);
  }
})(typeof window !== 'undefined' ? window : globalThis);
