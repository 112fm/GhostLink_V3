(function registerRealBlock1Adapter(globalScope) {
  const DEFAULT_API_BASE = 'https://api.112prd.ru';
  const DEFAULT_TIMEOUT_MS = 8000;

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
    const timeoutId = controller ? globalScope.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs) : null;

    try {
      const response = await fetchImpl(url, { ...options, signal: controller?.signal });
      const raw = await response.text();
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
    const timeoutMs = toInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
    let token = '';
    let inFlight = null;
    let sessionState = null;

    if (typeof fetchImpl !== 'function') {
      throw createError('network', 'Браузер не поддерживает сетевые запросы.');
    }

    async function openSession() {
      const initData = String(getInitData() || '').trim();
      if (!initData) {
        throw createError('auth', 'Откройте Mini App через Telegram ещё раз.', 401);
      }

      const session = await requestJson(fetchImpl, `${apiBase}/api/miniapp/session`, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams({ init_data: initData }),
      }, timeoutMs);
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
          await openSession();
          const [user, tariffs] = await Promise.all([
            requestJson(fetchImpl, `${apiBase}/api/user`, {
              method: 'GET', cache: 'no-store', credentials: 'include', headers: readHeaders(),
            }, timeoutMs),
            requestJson(fetchImpl, `${apiBase}/api/tariffs`, {
              method: 'GET', cache: 'no-store', credentials: 'include', headers: readHeaders(),
            }, timeoutMs),
          ]);
          return mapProfile(user, tariffs, now());
        })().finally(() => {
          inFlight = null;
        });
        return inFlight;
      },
      getSession: () => sessionState ? { ...sessionState } : null,
    });
  }

  const exported = { createRealBlock1Adapter };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    Object.assign(globalScope.GhostLinkV3, exported);
  }
})(typeof window !== 'undefined' ? window : globalThis);
