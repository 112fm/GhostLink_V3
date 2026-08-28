(function registerMockDeviceOperations(globalScope) {
  const STORAGE_KEY = 'ghostlink-v3-mock-device-operations-v1';

  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

  function createMemoryStorage() {
    const values = new Map();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    };
  }

  function readRecords(storage) {
    try {
      const value = storage.getItem(STORAGE_KEY);
      return value ? JSON.parse(value) : {};
    } catch {
      return {};
    }
  }

  function writeRecords(storage, records) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // Some Telegram WebViews can refuse storage. The current session still works.
    }
  }

  function createMockDeviceOperations(options = {}) {
    let browserStorage = null;
    try {
      browserStorage = globalScope?.localStorage || null;
    } catch {
      browserStorage = null;
    }
    const storage = options.storage || browserStorage || createMemoryStorage();
    const now = options.now || (() => new Date().toISOString());
    let online = options.online !== false;
    let createCount = 0;

    function getRecord(requestId) {
      return readRecords(storage)[requestId] || null;
    }

    function saveRecord(record) {
      const records = readRecords(storage);
      records[record.requestId] = record;
      writeRecords(storage, records);
    }

    function statusFromRecord(record, options = {}) {
      const includeDevice = options.includeDevice || !record.hideDeviceUntilReplay || record.replayDelivered;
      return {
        requestId: record.requestId,
        status: record.status,
        code: record.code || null,
        message: record.message || null,
        device: includeDevice && record.device ? clone(record.device) : null,
        updatedAt: record.updatedAt,
      };
    }

    return Object.freeze({
      async createDevice({ requestId, target = 'this-device', scenario = 'success', ownerId = 'local-owner', replay = false } = {}) {
        if (!requestId) {
          return { status: 'failed', code: 'bad_request', message: 'Не передан request_id.' };
        }

        if (scenario === 'limit') {
          createCount += 1;
          return {
            requestId,
            status: 'failed',
            code: 'device_limit_reached',
            message: 'Свободных мест для устройств нет.',
          };
        }

        const existingRecord = getRecord(requestId);
        if (existingRecord) {
          if (existingRecord.ownerId !== ownerId) {
            return {
              requestId,
              status: 'failed',
              code: 'request_forbidden',
              message: 'Операция принадлежит другому локальному пользователю.',
            };
          }
          if (existingRecord.target !== target) {
            return {
              requestId,
              status: 'conflict',
              code: 'request_conflict',
              message: 'Нельзя менять данные операции с тем же request_id.',
            };
          }
          if (replay && existingRecord.status === 'succeeded') {
            existingRecord.replayDelivered = true;
            existingRecord.updatedAt = now();
            saveRecord(existingRecord);
            return statusFromRecord(existingRecord, { includeDevice: true });
          }
          return {
            requestId,
            status: 'conflict',
            code: 'request_conflict',
            message: 'Операция с этим request_id уже существует.',
          };
        }

        createCount += 1;
        const record = {
          requestId,
          ownerId,
          target,
          scenario,
          status: 'accepted',
          polls: 0,
          createdAt: now(),
          updatedAt: now(),
          code: null,
          message: 'Операция принята в локальную mock-очередь.',
          device: null,
          hideDeviceUntilReplay: scenario === 'lost-response',
          replayDelivered: false,
        };
        saveRecord(record);

        if (scenario === 'timeout' || scenario === 'lost-response') {
          const error = new Error('Mock create request timed out.');
          error.type = 'timeout';
          error.requestId = requestId;
          throw error;
        }

        if (!online) {
          const error = new Error('Mock network is offline.');
          error.type = 'network';
          error.requestId = requestId;
          throw error;
        }

        return statusFromRecord(record);
      },

      async getStatus(requestId, { ownerId = 'local-owner' } = {}) {
        if (!online) {
          const error = new Error('Mock network is offline.');
          error.type = 'network';
          error.requestId = requestId;
          throw error;
        }

        const record = getRecord(requestId);
        if (!record || record.ownerId !== ownerId) return null;

        if (record.status === 'accepted' || record.status === 'processing') {
          record.polls += 1;
          if (record.polls === 1) {
            record.status = 'processing';
            record.message = 'Создаём локальный макет устройства.';
          } else if (record.scenario === 'failed') {
            record.status = 'failed';
            record.code = 'mock_verification_failed';
            record.message = 'Mock-операция завершилась ошибкой проверки.';
          } else {
            record.status = 'succeeded';
            record.message = 'Макет устройства подготовлен.';
            record.device = {
              id: `mock-device-${record.requestId}`,
              name: 'Локальное тестовое устройство',
              setupToken: `mock-device-${record.requestId}`,
            };
          }
          record.updatedAt = now();
          saveRecord(record);
        }

        return statusFromRecord(record);
      },

      setOnline(nextOnline) {
        online = Boolean(nextOnline);
      },

      getCreateCount: () => createCount,
      getSavedOperation: (requestId) => clone(getRecord(requestId)),
    });
  }

  const exported = { createMockDeviceOperations };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    globalScope.GhostLinkV3.createMockDeviceOperations = createMockDeviceOperations;
  }
})(typeof window !== 'undefined' ? window : globalThis);
