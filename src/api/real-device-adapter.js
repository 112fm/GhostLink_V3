(function registerRealDeviceAdapter(globalScope) {
  const DEFAULT_API_BASE = 'https://api.112prd.ru';
  const DEFAULT_TIMEOUT_MS = 10000;

  function createError(type, message, status, data) {
    const error = new Error(message || type);
    error.type = type;
    if (status) error.status = status;
    if (data !== undefined) error.data = data;
    error.code = data?.code || data?.detail || type;
    return error;
  }

  function normalizeDevice(item, index) {
    const source = item && typeof item === 'object' ? item : {};
    const id = String(source.id || source.uuid || '').trim();
    if (!id) return null;
    return {
      id,
      name: String(source.name || source.email || `Устройство ${index + 1}`),
      platform: String(source.platform || source.device_type || 'unknown'),
      app: String(source.app || 'Не определено'),
      status: source.is_active === false || source.enable === false ? 'offline' : (source.status || 'online'),
      lastActive: source.lastActive || source.last_online || 'Нет данных',
      traffic: source.traffic || 'Нет данных',
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
    return {
      ...source,
      requestId: source.request_id || source.requestId || null,
      status: source.status || (source.ok ? 'succeeded' : 'failed'),
      device,
      type: source.type || result.type || (result.deleted_id || source.deleted_id ? 'remove' : device ? 'rotate' : undefined),
      deletedId: source.deleted_id || result.deleted_id || null,
      message: source.error?.message || source.error_code || source.detail || source.message || '',
    };
  }

  function createRealDeviceAdapter(options = {}) {
    const apiBase = String(options.apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
    const fetchImpl = options.fetch || globalScope.fetch?.bind(globalScope);
    const getToken = options.getToken || (() => '');
    const timeoutMs = Math.max(1, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);

    async function request(path, requestOptions = {}) {
      if (typeof fetchImpl !== 'function') throw createError('network', 'Сетевой клиент недоступен.');
      const token = String(getToken() || '').trim();
      if (!token) throw createError('auth', 'Сессия Mini App ещё не готова.', 401);
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      let timer;
      try {
        const response = await Promise.race([
          fetchImpl(`${apiBase}${path}`, {
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
            }, timeoutMs);
          }),
        ]);
        const text = await response.text();
        let data = null;
        try { data = text ? JSON.parse(text) : {}; } catch (_) {
          throw createError('invalid_json', 'Сервер вернул некорректные данные.', response.status);
        }
        if (!response.ok) throw createError(response.status === 401 || response.status === 403 ? 'auth' : 'api', data?.detail || 'Операция не выполнена.', response.status, data);
        return data;
      } catch (error) {
        if (error?.type) throw error;
        if (error?.name === 'AbortError') throw createError('timeout', 'Сервер отвечает слишком долго.');
        throw createError('network', 'Не удалось связаться с GhostLink.');
      } finally {
        if (timer) globalScope.clearTimeout(timer);
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

    return Object.freeze({ fetchList, createDevice, start, getStatus });
  }

  const exported = { createRealDeviceAdapter, normalizeList, normalizeOperation };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    Object.assign(globalScope.GhostLinkV3, exported);
  }
})(typeof window !== 'undefined' ? window : globalThis);
