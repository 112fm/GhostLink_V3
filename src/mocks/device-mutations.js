(function registerMockDeviceMutations(globalScope) {
  const STORAGE_KEY = 'ghostlink-v3-mock-device-mutations-v1';
  const MUTATION_TYPES = new Set(['rotate', 'reset', 'remove']);

  function createMemoryStorage() {
    const values = new Map();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    };
  }

  function createMockDeviceMutations(options = {}) {
    let storage = options.storage || null;
    if (!storage) {
      try {
        storage = globalScope?.localStorage || null;
      } catch {
        storage = null;
      }
    }
    // This fallback lasts for the current Mini App session. It does not pretend
    // to survive a full reload when a WebView forbids persistent storage.
    const sessionStorage = options.sessionStorage || createMemoryStorage();
    const now = options.now || (() => new Date().toISOString());
    let online = options.online !== false;
    let startCount = 0;

    function readRecords() {
      try {
        const sessionValue = sessionStorage.getItem(STORAGE_KEY);
        if (sessionValue) return JSON.parse(sessionValue);
      } catch {
        // The call-local object below remains the final fallback.
      }
      try {
        const persisted = storage?.getItem(STORAGE_KEY);
        return persisted ? JSON.parse(persisted) : {};
      } catch {
        // SecurityError is expected in restrictive Telegram WebViews.
        return {};
      }
    }

    function writeRecords(records) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch {
        // The adapter still continues with its in-memory object for this call.
      }
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch {
        // Persistent storage is optional; sessionStorage above keeps the request safe.
      }
    }

    function toResult(record) {
      return {
        requestId: record.requestId,
        type: record.type,
        deviceId: record.deviceId,
        status: record.status,
        code: record.code || null,
        message: record.message || null,
        updatedAt: record.updatedAt,
      };
    }

    function hasActiveMutation(records, deviceId) {
      return Object.values(records).some((record) => record.deviceId === deviceId
        && ['accepted', 'processing'].includes(record.status));
    }

    return Object.freeze({
      async start({ requestId, type, deviceId, scenario = 'success' } = {}) {
        if (!requestId || !deviceId || !MUTATION_TYPES.has(type)) {
          return { requestId, status: 'failed', code: 'bad_request', message: 'Недостаточно данных для операции.' };
        }

        const records = readRecords();
        if (records[requestId]) {
          return { ...toResult(records[requestId]), status: 'conflict', code: 'request_conflict', message: 'Эта операция уже зарегистрирована.' };
        }
        if (hasActiveMutation(records, deviceId)) {
          return { requestId, type, deviceId, status: 'conflict', code: 'device_operation_in_progress', message: 'Для этого устройства уже выполняется операция.' };
        }

        startCount += 1;
        const record = {
          requestId,
          type,
          deviceId,
          scenario,
          status: 'accepted',
          polls: 0,
          code: null,
          message: 'Локальная операция принята.',
          createdAt: now(),
          updatedAt: now(),
        };
        records[requestId] = record;
        writeRecords(records);

        if (scenario === 'timeout') {
          const error = new Error('Mock device mutation timed out.');
          error.type = 'timeout';
          error.requestId = requestId;
          throw error;
        }
        if (!online) {
          const error = new Error('Mock device mutation is offline.');
          error.type = 'network';
          error.requestId = requestId;
          throw error;
        }
        return toResult(record);
      },

      async getStatus(requestId) {
        if (!online) {
          const error = new Error('Mock device mutation is offline.');
          error.type = 'network';
          error.requestId = requestId;
          throw error;
        }

        const records = readRecords();
        const record = records[requestId];
        if (!record) return null;
        if (record.status === 'accepted' || record.status === 'processing') {
          record.polls += 1;
          if (record.polls === 1) {
            record.status = 'processing';
            record.message = 'Проверяем локальную операцию.';
          } else if (record.scenario === 'failed') {
            record.status = 'failed';
            record.code = 'mock_mutation_failed';
            record.message = 'Локальная операция завершилась ошибкой.';
          } else {
            record.status = 'succeeded';
            record.message = 'Локальная операция завершена.';
          }
          record.updatedAt = now();
          records[requestId] = record;
          writeRecords(records);
        }
        return toResult(record);
      },

      setOnline(nextOnline) {
        online = Boolean(nextOnline);
      },

      getStartCount: () => startCount,
    });
  }

  const exported = { createMockDeviceMutations };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    globalScope.GhostLinkV3.createMockDeviceMutations = createMockDeviceMutations;
  }
})(typeof window !== 'undefined' ? window : globalThis);
