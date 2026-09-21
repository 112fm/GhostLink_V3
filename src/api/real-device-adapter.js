(function registerRealDeviceAdapter(globalScope) {
  const DEFAULT_API_BASE = 'https://panel.112prd.ru:2053';
  const DEFAULT_FALLBACK_API_BASE = 'https://api.112prd.ru:2053';
  const DEFAULT_TIMEOUT_MS = 15000;
  const DEFAULT_FAST_FALLBACK_TIMEOUT_MS = 2500;

  function createError(type, message, status, data) {
    const error = new Error(message || type);
    error.type = type;
    if (status) error.status = status;
    if (data !== undefined) error.data = data;
    error.code = data?.code || data?.detail || type;
    return error;
  }

  function raceFirstSuccess(promises) {
    return new Promise((resolve, reject) => {
      let pending = promises.length;
      let lastError = null;
      promises.forEach((p) => {
        Promise.resolve(p).then(
          (val) => resolve(val),
          (err) => {
            lastError = err;
            pending -= 1;
            if (pending <= 0) reject(lastError);
          }
        );
      });
    });
  }

  function formatErrorMessage(codeOrMsg) {
    const raw = String(codeOrMsg || '').trim();
    if (!raw) return '';
    if (raw.includes('partial_failure_restored')) {
      return 'Не удалось завершить операцию. Исходное состояние устройства восстановлено.';
    }
    if (raw.includes('device_delete_rolled_back')) {
      return 'Удаление не завершено. Устройство восстановлено и остаётся в списке.';
    }
    if (raw.includes('partial_failure_unrecovered')) {
      return 'Ошибка операции: часть настроек не удалось применить. Обратитесь в поддержку.';
    }
    if (raw.includes('device_limit_reached') || raw.includes('limit_exceeded')) {
      return 'Лимит устройств исчерпан. Освободите слот или увеличьте тариф.';
    }
    if (raw.includes('panel_pair_delete_failed')) {
      return 'Не удалось удалить устройство на сервере. Повторите попытку позже.';
    }
    if (raw.includes('endpoint_deprecated')) {
      return 'Функция устарела. Используйте обновление ключа.';
    }
    return raw;
  }

  function normalizeDevice(item, index) {
    const source = item && typeof item === 'object' ? item : {};
    const id = String(source.id || source.uuid || '').trim();
    if (!id) return null;
    return {
      id,
      name: String(source.name || source.email || `Устройство ${index + 1}`),
      platform: String(source.platform || source.device_type || 'unknown'),
      app: source.app ? String(source.app) : '',
      status: source.is_active === false || source.enable === false ? 'offline' : (source.status || 'online'),
      lastActive: source.lastActive || source.last_online || (source.is_active !== false ? 'Активно' : 'Офлайн'),
      traffic: source.traffic ? String(source.traffic) : null,
      isCurrent: source.is_current === true || source.isCurrent === true,
      url: typeof source.url === 'string' ? source.url : (typeof source.subscription_url === 'string' ? source.subscription_url : ''),
      url_incy: typeof source.url_incy === 'string' ? source.url_incy : (typeof source.subscription_url_incy === 'string' ? source.subscription_url_incy : ''),
    };
  }

  function normalizeList(data) {
    const source = data && typeof data === 'object' ? data : {};
    const devices = (Array.isArray(source.devices) ? source.devices : [])
      .map(normalizeDevice)
      .filter(Boolean);
    const deviceLimit = Math.max(0, Number(source.device_limit) || 0);
    const usedSlots = Math.max(0, Number(source.connected_devices ?? source.connected ?? devices.length) || 0);
    const freeSlots = Math.max(0, deviceLimit - usedSlots);
    return {
      status: devices.length === 0 ? 'empty' : freeSlots === 0 ? 'limit' : 'loaded',
      devices,
      usedSlots,
      freeSlots,
      deviceLimit,
      canAdd: source.can_add !== false && freeSlots > 0,
    };
  }

  function normalizeOperation(data) {
    const source = data && typeof data === 'object' ? data : {};
    const result = source.result && typeof source.result === 'object' ? source.result : {};
    const device = normalizeDevice(source.device || result.device, 0);
    const rawMsg = source.error?.message || source.error_code || source.detail || source.message || '';
    return {
      ...source,
      requestId: source.request_id || source.requestId || null,
      status: source.status || (source.ok ? 'succeeded' : 'failed'),
      device,
      type: source.type || result.type || (result.deleted_id || source.deleted_id ? 'remove' : device ? 'rotate' : undefined),
      deletedId: source.deleted_id || result.deleted_id || null,
      message: formatErrorMessage(rawMsg),
    };
  }

  function createRealDeviceAdapter(options = {}) {
    const getDynamicApiBase = typeof options.getApiBase === 'function' ? options.getApiBase : null;
    const primaryApiBase = String(options.apiBase || (getDynamicApiBase ? getDynamicApiBase() : '') || DEFAULT_API_BASE).replace(/\/+$/, '');
    const fallbackApiBase = options.fallbackApiBase !== undefined
      ? String(options.fallbackApiBase || '').replace(/\/+$/, '')
      : (primaryApiBase === DEFAULT_API_BASE ? DEFAULT_FALLBACK_API_BASE : (primaryApiBase === DEFAULT_FALLBACK_API_BASE ? DEFAULT_API_BASE : ''));
    let activeApiBase = primaryApiBase;
    const fetchImpl = options.fetch || globalScope.fetch?.bind(globalScope);
    const getToken = options.getToken || (() => '');
    const timeoutMs = Math.max(1, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
    const fallbackThresholdMs = Math.max(1, Number(options.fallbackThresholdMs) || DEFAULT_FAST_FALLBACK_TIMEOUT_MS);

    function getEffectiveBase() {
      if (getDynamicApiBase) {
        const dyn = getDynamicApiBase();
        if (dyn) return String(dyn).replace(/\/+$/, '');
      }
      return activeApiBase;
    }

    async function executeSingleRequest(baseUrl, path, requestOptions, token, reqTimeoutMs) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      let timer;
      try {
        const response = await Promise.race([
          fetchImpl(`${baseUrl}${path}`, {
            ...requestOptions,
            signal: controller?.signal,
            headers: {
              Accept: 'application/json',
              'X-PWA-Token': token,
              ...(requestOptions.headers || {}),
            },
          }),
          new Promise((_, reject) => {
            timer = globalScope.setTimeout(() => {
              controller?.abort();
              reject(createError('timeout', 'Сервер отвечает слишком долго.'));
            }, reqTimeoutMs);
          }),
        ]);
        const text = await response.text();
        let data = null;
        try { data = text ? JSON.parse(text) : {}; } catch (_) {
          throw createError('invalid_json', 'Сервер вернул некорректные данные.', response.status);
        }
        if (!response.ok) {
          const rawMessage = data?.detail || data?.message || 'Операция не выполнена.';
          throw createError(
            response.status === 401 || response.status === 403 ? 'auth' : 'api',
            formatErrorMessage(rawMessage),
            response.status,
            data,
          );
        }
        return data;
      } catch (error) {
        if (error?.type) throw error;
        if (error?.name === 'AbortError') throw createError('timeout', 'Сервер отвечает слишком долго.');
        throw createError('network', 'Не удалось связаться с GhostLink.');
      } finally {
        if (timer) globalScope.clearTimeout(timer);
      }
    }

    async function request(path, requestOptions = {}) {
      if (typeof fetchImpl !== 'function') throw createError('network', 'Сетевой клиент недоступен.');
      const token = String(getToken() || '').trim();
      if (!token) throw createError('auth', 'Сессия Mini App ещё не готова.', 401);

      const firstBase = getEffectiveBase();
      const currentFallback = (fallbackApiBase && firstBase !== fallbackApiBase)
        ? fallbackApiBase
        : (firstBase === DEFAULT_API_BASE ? DEFAULT_FALLBACK_API_BASE : '');

      if (!currentFallback || firstBase === currentFallback) {
        return executeSingleRequest(firstBase, path, requestOptions, token, timeoutMs);
      }

      let fallbackStarted = false;
      let fallbackPromise = null;

      function triggerFallback() {
        if (fallbackStarted) return fallbackPromise;
        fallbackStarted = true;
        fallbackPromise = executeSingleRequest(currentFallback, path, requestOptions, token, timeoutMs);
        return fallbackPromise;
      }

      const thresholdMs = Math.min(timeoutMs, fallbackThresholdMs);
      let thresholdTimer = null;
      const thresholdPromise = new Promise((resolve) => {
        thresholdTimer = globalScope.setTimeout(() => {
          resolve('threshold_timeout');
        }, thresholdMs);
      });

      const primaryPromise = executeSingleRequest(firstBase, path, requestOptions, token, timeoutMs);

      try {
        const firstResolution = await Promise.race([
          primaryPromise.then((res) => ({ type: 'primary_success', res })),
          thresholdPromise.then(() => ({ type: 'threshold_reached' })),
        ]);

        if (thresholdTimer) globalScope.clearTimeout(thresholdTimer);

        if (firstResolution.type === 'primary_success') {
          return firstResolution.res;
        }

        const fb = triggerFallback();
        return await raceFirstSuccess([primaryPromise, fb]);
      } catch (firstError) {
        if (thresholdTimer) globalScope.clearTimeout(thresholdTimer);
        const isNetworkOrTimeout = firstError?.type === 'network' || firstError?.type === 'timeout';
        if (isNetworkOrTimeout) {
          try {
            return await triggerFallback();
          } catch (fallbackError) {
            throw fallbackError;
          }
        }
        throw firstError;
      }
    }

    async function fetchList() {
      return normalizeList(await request('/api/device/list', { method: 'GET', cache: 'no-store' }));
    }

    async function createDevice({ requestId, name, platform, target } = {}) {
      const data = await request('/api/device/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId },
        body: JSON.stringify({ device_name: name || 'Новое устройство', device_type: platform || target || 'unknown', request_id: requestId }),
      });
      const operation = normalizeOperation(data);
      if (!operation.type) operation.type = 'add';
      return operation;
    }

    async function start({ requestId, type, deviceId } = {}) {
      const endpoint = type === 'rotate' ? '/api/device/rotate' : type === 'remove' ? '/api/device/remove' : '';
      if (!endpoint) throw createError('api', 'Эта операция не поддерживается серверным контрактом.');
      const data = await request(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId },
        body: JSON.stringify({ device_id: deviceId, request_id: requestId }),
      });
      const operation = normalizeOperation(data);
      if (!operation.type) operation.type = type;
      return operation;
    }

    async function getStatus(requestId) {
      return normalizeOperation(await request(`/api/device/operations/${encodeURIComponent(requestId)}`, { method: 'GET', cache: 'no-store' }));
    }

    return Object.freeze({ fetchList, createDevice, start, getStatus, getApiBase: () => getEffectiveBase() });
  }

  const exported = { createRealDeviceAdapter, normalizeList, normalizeOperation };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    Object.assign(globalScope.GhostLinkV3, exported);
  }
})(typeof window !== 'undefined' ? window : globalThis);
