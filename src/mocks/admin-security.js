(function initAdminMockSecurity(globalScope) {
  const STORAGE_KEY = 'ghostlink-v3-local-admin-operations-v1';

  function createMemoryStorage() {
    const values = new Map();
    return {
      getItem: (key) => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
    };
  }

  function getSafeStorage(candidate) {
    try {
      if (!candidate) return createMemoryStorage();
      candidate.getItem(STORAGE_KEY);
      return candidate;
    } catch {
      return createMemoryStorage();
    }
  }

  function createAdminMockSession({ role = 'user' } = {}) {
    const resolvedRole = role === 'admin' ? 'admin' : 'user';
    return Object.freeze({
      role: resolvedRole,
      isAdmin: () => resolvedRole === 'admin',
      assertAdmin: (action = 'admin_action') => {
        if (resolvedRole === 'admin') return true;
        const error = new Error('Недостаточно прав для локальной админ-операции.');
        error.code = 'admin_role_required';
        error.action = action;
        throw error;
      },
    });
  }

  function protectAdminAdapter(adapter, session) {
    return new Proxy(adapter, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (typeof value !== 'function') return value;
        return (...args) => {
          session.assertAdmin(String(property));
          return value.apply(target, args);
        };
      },
    });
  }

  function createAdminMockOperationStore({ storage } = {}) {
    const safeStorage = getSafeStorage(storage || globalScope?.localStorage);

    function read() {
      try {
        const raw = safeStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }

    function save(records) {
      safeStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }

    function clone(value) {
      return value ? JSON.parse(JSON.stringify(value)) : null;
    }

    return Object.freeze({
      start({ requestId, actionType, serverId = null } = {}) {
        if (!requestId || !actionType) {
          const error = new Error('Для mock-операции нужны request_id и тип действия.');
          error.code = 'bad_request';
          throw error;
        }
        const records = read();
        if (records[requestId]) return clone(records[requestId]);

        const record = {
          requestId,
          actionType,
          serverId,
          jobId: `mock-admin-job-${requestId}`,
          status: 'queued',
          createdAt: new Date().toISOString(),
        };
        records[requestId] = record;
        save(records);
        return clone(record);
      },
      get(requestId) {
        return clone(read()[requestId]);
      },
      getByJobId(jobId) {
        return Object.values(read()).find((record) => record.jobId === jobId) || null;
      },
      complete(requestId) {
        const records = read();
        const record = records[requestId];
        if (!record) return null;
        if (record.status === 'queued') {
          record.status = 'succeeded';
          record.completedAt = new Date().toISOString();
          records[requestId] = record;
          save(records);
        }
        return clone(record);
      },
      completeByJobId(jobId) {
        const record = this.getByJobId(jobId);
        return record ? this.complete(record.requestId) : null;
      },
      storageKey: STORAGE_KEY,
    });
  }

  const api = Object.freeze({
    createAdminMockSession,
    protectAdminAdapter,
    createAdminMockOperationStore,
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!globalScope?.document) return;

  const GhostLinkV3 = globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
  GhostLinkV3.AdminMockSecurity = api;
  // Default deny in every hosted build. The owner enables the local mock role
  // only for a file preview; this value is not tied to a visible UI element.
  GhostLinkV3.adminMockSession = createAdminMockSession({
    role: globalScope.location.protocol === 'file:' ? 'admin' : 'user',
  });
}(typeof window !== 'undefined' ? window : globalThis));
