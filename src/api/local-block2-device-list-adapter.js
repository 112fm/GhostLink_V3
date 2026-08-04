(function registerLocalDeviceListAdapter(globalScope) {
  const DEFAULT_RESPONSE = Object.freeze({
    connected: 3,
    device_limit: 5,
    items: Object.freeze([
      Object.freeze({ uuid: 'local-device-iphone', email: 'iPhone 15 Pro', last_online: 0, up: 0, down: 0 }),
      Object.freeze({ uuid: 'local-device-windows', email: 'Windows PC', last_online: null, up: 0, down: 0 }),
      Object.freeze({ uuid: 'local-device-tv', email: 'Apple TV 4K', last_online: null, up: 0, down: 0 }),
    ]),
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function asNonNegativeInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
  }

  function asNonNegativeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }

  function asTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value < 1e12 ? value * 1000 : value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  // The single presentation mapper accepts seconds, milliseconds, or ISO dates.
  function formatLastOnline(value, now = Date.now()) {
    const timestamp = asTimestamp(value);
    if (!timestamp || timestamp > now + 5 * 60 * 1000) return 'Нет данных';

    const elapsedMs = Math.max(0, now - timestamp);
    const minutes = Math.floor(elapsedMs / (60 * 1000));
    if (minutes < 5) return 'Онлайн сейчас';
    if (minutes < 60) return `${minutes} мин. назад`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч. назад`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} дн. назад`;
    return `${Math.floor(days / 30)} мес. назад`;
  }

  function formatDeviceTraffic(up, down) {
    const total = asNonNegativeNumber(up) + asNonNegativeNumber(down);
    if (total === 0) return '0 Б';

    const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
    const index = Math.min(Math.floor(Math.log(total) / Math.log(1024)), units.length - 1);
    const value = total / (1024 ** index);
    const rounded = value >= 10 || Number.isInteger(value) ? Math.round(value) : Math.round(value * 10) / 10;
    return `${rounded} ${units[index]}`;
  }

  function normalizeDevice(item, index, now) {
    const lastActive = formatLastOnline(item?.last_online, now);
    const uuid = typeof item?.uuid === 'string' && item.uuid.trim()
      ? item.uuid.trim()
      : `local-device-${index + 1}`;
    const label = typeof item?.email === 'string' ? item.email.trim() : '';

    return {
      // UUID stays only in this in-memory card model as the future API's internal ID.
      id: uuid,
      name: label || `Устройство ${index + 1}`,
      platform: 'unknown',
      app: 'Не определено',
      status: lastActive === 'Онлайн сейчас' ? 'online' : 'offline',
      lastActive,
      traffic: formatDeviceTraffic(item?.up, item?.down),
      isCurrent: false,
    };
  }

  function normalizeDeviceListResponse(response, options = {}) {
    const source = response && typeof response === 'object' ? response : {};
    const now = Number.isFinite(options.now) ? options.now : Date.now();
    const items = Array.isArray(source.items) ? source.items : [];
    const deviceLimit = asNonNegativeInteger(source.device_limit);
    const usedSlots = asNonNegativeInteger(source.connected);
    const freeSlots = Math.max(0, deviceLimit - usedSlots);

    return {
      status: usedSlots === 0 ? 'empty' : freeSlots === 0 ? 'limit' : 'loaded',
      devices: items.map((item, index) => normalizeDevice(item, index, now)),
      usedSlots,
      freeSlots,
      deviceLimit,
    };
  }

  function refreshSnapshotStatus(snapshot) {
    snapshot.usedSlots = snapshot.devices.length;
    snapshot.freeSlots = Math.max(0, snapshot.deviceLimit - snapshot.usedSlots);
    snapshot.status = snapshot.usedSlots === 0 ? 'empty' : snapshot.freeSlots === 0 ? 'limit' : 'loaded';
    return snapshot;
  }

  function createLocalError(type, message) {
    const error = new Error(message);
    error.type = type;
    return error;
  }

  function createLocalDeviceListAdapter(options = {}) {
    let mode = options.mode || 'loaded';
    let response = clone(options.response || DEFAULT_RESPONSE);
    let inFlight = null;
    let fetchCount = 0;
    let localSnapshot = null;

    function wait() {
      if (!options.delayMs) return Promise.resolve();
      return new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    return Object.freeze({
      fetchList() {
        if (inFlight) return inFlight;

        fetchCount += 1;
        inFlight = wait().then(() => {
          if (mode === 'offline') throw createLocalError('network', 'Локальный список устройств недоступен без сети.');
          if (mode === 'timeout') throw createLocalError('timeout', 'Локальный список устройств превысил время ожидания.');
          if (!localSnapshot) {
            localSnapshot = normalizeDeviceListResponse(response, { now: typeof options.now === 'function' ? options.now() : Date.now() });
          }
          return clone(localSnapshot);
        }).finally(() => {
          inFlight = null;
        });
        return inFlight;
      },

      setMode(nextMode) {
        mode = nextMode;
      },

      setResponse(nextResponse) {
        response = clone(nextResponse && typeof nextResponse === 'object' ? nextResponse : {});
        localSnapshot = null;
      },

      getFetchCount() {
        return fetchCount;
      },

      // Compatibility for the already local-only setup and mutation mocks.
      // These methods never call a service or persist identifiers; they only keep
      // the current V3 preview coherent until Block 3 is connected later.
      addOperationDevice({ device, target } = {}) {
        if (!device?.id) return false;
        if (!localSnapshot) {
          localSnapshot = normalizeDeviceListResponse(response, { now: typeof options.now === 'function' ? options.now() : Date.now() });
        }
        if (localSnapshot.devices.some((item) => item.id === device.id)) return true;
        if (localSnapshot.freeSlots === 0) return false;

        localSnapshot.devices.unshift({
          id: device.id,
          name: device.name || 'Локальное тестовое устройство',
          platform: target === 'other-device' ? 'unknown' : 'phone',
          app: 'Не выбрано',
          status: 'offline',
          lastActive: 'Ожидает настройки',
          traffic: '0 Б',
          isCurrent: target === 'this-device',
        });
        refreshSnapshotStatus(localSnapshot);
        return true;
      },

      applyMutation(result = {}) {
        if (result.status !== 'succeeded' || !result.deviceId) return false;
        if (!localSnapshot) {
          localSnapshot = normalizeDeviceListResponse(response, { now: typeof options.now === 'function' ? options.now() : Date.now() });
        }
        const index = localSnapshot.devices.findIndex((device) => device.id === result.deviceId);
        if (index < 0) return false;

        if (result.type === 'remove') {
          localSnapshot.devices.splice(index, 1);
        } else if (result.type === 'rotate') {
          localSnapshot.devices[index] = {
            ...localSnapshot.devices[index],
            status: 'offline',
            lastActive: 'Ключ обновлён',
          };
        } else if (result.type === 'reset') {
          localSnapshot.devices[index] = {
            ...localSnapshot.devices[index],
            app: 'Не выбрано',
            status: 'offline',
            lastActive: 'Нужна повторная настройка',
            traffic: '0 Б',
          };
        } else {
          return false;
        }

        refreshSnapshotStatus(localSnapshot);
        return true;
      },
    });
  }

  const exported = {
    createLocalDeviceListAdapter,
    formatDeviceTraffic,
    formatLastOnline,
    normalizeDeviceListResponse,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    Object.assign(globalScope.GhostLinkV3, exported);
  }
})(typeof window !== 'undefined' ? window : globalThis);
