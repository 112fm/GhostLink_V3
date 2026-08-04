(function registerMockDeviceList(globalScope) {
  const STORAGE_KEY = 'ghostlink-v3-mock-device-list-v1';

  const DEFAULT_DEVICES = Object.freeze([
    { id: 'dev-iphone', name: 'iPhone 15 Pro', platform: 'phone', app: 'INCY', status: 'online', lastActive: 'Онлайн сейчас', traffic: '227.4 ГБ', isCurrent: true },
    { id: 'dev-windows', name: 'Windows PC', platform: 'laptop', app: 'Karing', status: 'offline', lastActive: '24 дн. назад', traffic: '3.6 ГБ', isCurrent: false },
    { id: 'dev-tv', name: 'Apple TV 4K', platform: 'tv', app: 'Karing', status: 'offline', lastActive: '1 мес. назад', traffic: '91.2 ГБ', isCurrent: false },
  ]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createMemoryStorage() {
    const values = new Map();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    };
  }

  function getStorage(options) {
    if (options.storage) return options.storage;
    try {
      return globalScope?.localStorage || createMemoryStorage();
    } catch {
      return createMemoryStorage();
    }
  }

  function createMockDeviceList(options = {}) {
    const storage = getStorage(options);
    const deviceLimit = Number.isInteger(options.deviceLimit) ? options.deviceLimit : 5;
    let mode = options.mode || 'loaded';
    let inFlight = null;
    let fetchCount = 0;

    function readDevices() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch {
        // Start a new local mock snapshot if a restrictive WebView blocks storage.
      }
      return clone(options.devices || DEFAULT_DEVICES);
    }

    function writeDevices(devices) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(devices));
      } catch {
        // The active local list stays usable even without reload recovery.
      }
    }

    function buildSnapshot() {
      const devices = readDevices();
      const usedSlots = devices.length;
      const freeSlots = Math.max(0, deviceLimit - usedSlots);
      return {
        status: usedSlots === 0 ? 'empty' : freeSlots === 0 ? 'limit' : 'loaded',
        devices: clone(devices),
        usedSlots,
        freeSlots,
        deviceLimit,
      };
    }

    function wait() {
      if (!options.delayMs) return Promise.resolve();
      return new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    return Object.freeze({
      fetchList() {
        if (inFlight) return inFlight;

        fetchCount += 1;
        inFlight = wait().then(() => {
          if (mode === 'offline') {
            const error = new Error('Mock device list is offline.');
            error.type = 'network';
            throw error;
          }
          if (mode === 'timeout') {
            const error = new Error('Mock device list timed out.');
            error.type = 'timeout';
            throw error;
          }
          return buildSnapshot();
        }).finally(() => {
          inFlight = null;
        });
        return inFlight;
      },

      addOperationDevice({ requestId, target, device } = {}) {
        if (!requestId || !device?.id) return false;
        const devices = readDevices();
        if (devices.some((item) => item.id === device.id)) return true;
        if (devices.length >= deviceLimit) return false;

        devices.unshift({
          id: device.id,
          name: device.name || 'Локальное тестовое устройство',
          platform: target === 'other-device' ? 'laptop' : 'phone',
          app: 'Не выбрано',
          status: 'setup',
          lastActive: 'Ожидает настройки',
          traffic: '0 Б',
          isCurrent: target === 'this-device',
          operationId: requestId,
        });
        writeDevices(devices);
        return true;
      },

      applyMutation(result = {}) {
        if (result.status !== 'succeeded' || !result.deviceId) return false;
        const devices = readDevices();
        const index = devices.findIndex((device) => device.id === result.deviceId);
        if (index < 0) return false;

        if (result.type === 'remove') {
          devices.splice(index, 1);
        } else if (result.type === 'rotate') {
          devices[index] = {
            ...devices[index],
            setupToken: `mock-rotated-${result.requestId}`,
            status: 'setup',
            lastActive: 'Ключ обновлён',
          };
        } else if (result.type === 'reset') {
          devices[index] = {
            ...devices[index],
            app: 'Не выбрано',
            status: 'setup',
            lastActive: 'Нужна повторная настройка',
            traffic: '0 Б',
          };
        } else {
          return false;
        }

        writeDevices(devices);
        return true;
      },

      setMode(nextMode) {
        mode = nextMode;
      },

      getFetchCount: () => fetchCount,
    });
  }

  const exported = { createMockDeviceList };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    globalScope.GhostLinkV3.createMockDeviceList = createMockDeviceList;
  }
})(typeof window !== 'undefined' ? window : globalThis);
