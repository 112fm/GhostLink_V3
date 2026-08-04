(function registerMockInvites(globalScope) {
  const STORAGE_KEY = 'ghostlink-v3-mock-bridge-owner-contract-v1';
  const TTL_SECONDS = 24 * 60 * 60;
  const ACTIVE_STATUSES = new Set(['created', 'transferred', 'waiting_join']);
  const ALLOWED_TRANSITIONS = Object.freeze({
    created: new Set(['transferred', 'failed', 'expired']),
    transferred: new Set(['waiting_join', 'failed', 'expired']),
    waiting_join: new Set(['bound', 'failed', 'expired']),
    bound: new Set(),
    expired: new Set(),
    failed: new Set(),
  });

  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

  function createMemoryStorage() {
    const values = new Map();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
    };
  }

  function createMockInvites(options = {}) {
    let storage = options.storage || null;
    if (!storage) {
      try {
        storage = globalScope?.localStorage || null;
      } catch {
        storage = null;
      }
    }
    const sessionStorage = options.sessionStorage || createMemoryStorage();
    const clock = options.now || (() => Date.now());
    const ownerId = options.ownerId || 'mock-inviter';
    const referralCode = options.referralCode || '8fa492b';
    const invitations = options.invitations || [
      { id: 'maria', name: 'Мария', handle: '@maria_v', status: 'subscribed', createdAt: '8 дней назад' },
      { id: 'alex', name: 'Алексей', handle: '@alex_dev', status: 'pending', createdAt: '2 дня назад' },
      { id: 'igor', name: 'Игорь', handle: '@igor_k', status: 'expired', createdAt: '21 день назад' },
    ];
    let online = options.online !== false;
    let createCount = 0;

    function nowMs() {
      const value = clock();
      return value instanceof Date ? value.getTime() : Number(value);
    }

    function readRecords() {
      try {
        const sessionValue = sessionStorage.getItem(STORAGE_KEY);
        if (sessionValue) return JSON.parse(sessionValue);
      } catch {
        // Restricted WebViews can reject storage; the current adapter remains usable.
      }
      try {
        const persisted = storage?.getItem(STORAGE_KEY);
        return persisted ? JSON.parse(persisted) : {};
      } catch {
        return {};
      }
    }

    function writeRecords(records) {
      const value = JSON.stringify(records);
      try {
        sessionStorage.setItem(STORAGE_KEY, value);
      } catch {
        // Keep trying persistent storage below.
      }
      try {
        storage?.setItem(STORAGE_KEY, value);
      } catch {
        // Persistence is optional for local-only mocks.
      }
    }

    function toResponse(record) {
      return {
        request_id: record.request_id,
        status: record.status,
        temporary_key: record.temporary_key || null,
        invite_url: record.invite_url || null,
        expires_ts: record.expires_ts,
        bound_user_id: record.bound_user_id || null,
        error: record.error || null,
      };
    }

    function expireIfNeeded(record) {
      if (ACTIVE_STATUSES.has(record.status) && Math.floor(nowMs() / 1000) >= record.expires_ts) {
        record.status = 'expired';
        record.temporary_key = null;
        record.invite_url = null;
        record.error = null;
        record.updated_ts = Math.floor(nowMs() / 1000);
      }
      return record;
    }

    function notFoundError(requestId) {
      const error = new Error('Bridge-операция не найдена.');
      error.type = 'not_found';
      error.code = 'not_found';
      error.request_id = requestId;
      return error;
    }

    function getOwnedRecord(records, requestId) {
      const record = records[requestId];
      if (!record || record.owner_id !== ownerId) return null;
      return expireIfNeeded(record);
    }

    function activeRecordForOwner(records) {
      return Object.values(records)
        .filter((record) => record.owner_id === ownerId)
        .map(expireIfNeeded)
        .filter((record) => ACTIVE_STATUSES.has(record.status))
        .sort((left, right) => right.created_ts - left.created_ts)[0] || null;
    }

    function transition(requestId, nextStatus, patch = {}) {
      if (!online) {
        const error = new Error('Mock Bridge is offline.');
        error.type = 'network';
        error.request_id = requestId;
        throw error;
      }
      const records = readRecords();
      const record = getOwnedRecord(records, requestId);
      if (!record) throw notFoundError(requestId);
      // A failed operation retains its original reason on every later action.
      if (record.status === 'failed') return toResponse(record);
      if (record.status === nextStatus) return toResponse(record);
      if (!ALLOWED_TRANSITIONS[record.status]?.has(nextStatus)) {
        return {
          ...toResponse(record),
          error: { code: 'invalid_transition', message: 'Этот переход статуса недопустим.' },
        };
      }
      record.status = nextStatus;
      record.updated_ts = Math.floor(nowMs() / 1000);
      if (nextStatus === 'bound') record.bound_user_id = patch.bound_user_id || null;
      if (nextStatus === 'failed') record.error = patch.error || { code: 'mock_bridge_failed', message: 'Локальная Bridge-операция завершилась ошибкой.' };
      if (nextStatus === 'expired') {
        record.temporary_key = null;
        record.invite_url = null;
        record.bound_user_id = null;
        record.error = null;
      }
      records[requestId] = record;
      writeRecords(records);
      return toResponse(record);
    }

    function stats() {
      const totals = invitations.reduce((accumulator, invite) => {
        accumulator[invite.status] = (accumulator[invite.status] || 0) + 1;
        return accumulator;
      }, { subscribed: 0, pending: 0, expired: 0 });
      return {
        invited: invitations.length,
        subscribed: totals.subscribed,
        pending: totals.pending,
        expired: totals.expired,
        rewardDays: totals.subscribed * 14,
      };
    }

    return Object.freeze({
      async getSnapshot() {
        if (!online) {
          const error = new Error('Mock invites are offline.');
          error.type = 'network';
          throw error;
        }
        return {
          isMock: true,
          standardInvitation: { type: 'standard', isMock: true, url: `https://t.me/GhostLinkBot?start=ref_${referralCode}` },
          invitations: clone(invitations),
          stats: stats(),
        };
      },

      async createBridge({ request_id, scenario = 'success' } = {}) {
        if (!request_id) {
          return { request_id: null, status: 'failed', temporary_key: null, invite_url: null, expires_ts: 0, bound_user_id: null, error: { code: 'bad_request', message: 'Не передан request_id.' } };
        }
        const records = readRecords();
        const existing = records[request_id];
        if (existing) {
          if (existing.owner_id !== ownerId) throw notFoundError(request_id);
          return toResponse(expireIfNeeded(existing));
        }
        const ownerActive = activeRecordForOwner(records);
        if (ownerActive) return toResponse(ownerActive);

        createCount += 1;
        const createdTs = Math.floor(nowMs() / 1000);
        const suffix = request_id.replace(/[^a-z0-9]/gi, '').slice(-10) || referralCode;
        const record = {
          request_id,
          owner_id: ownerId,
          status: 'created',
          temporary_key: `ghostlink-mock://bridge/temp-${suffix}`,
          invite_url: `https://t.me/GhostLinkBot?start=bridge_mock_${suffix}`,
          expires_ts: createdTs + TTL_SECONDS,
          bound_user_id: null,
          error: null,
          scenario,
          created_ts: createdTs,
          updated_ts: createdTs,
        };
        records[request_id] = record;
        writeRecords(records);

        if (scenario === 'timeout') {
          const error = new Error('Mock Bridge request timed out.');
          error.type = 'timeout';
          error.request_id = request_id;
          throw error;
        }
        if (!online) {
          const error = new Error('Mock Bridge is offline.');
          error.type = 'network';
          error.request_id = request_id;
          throw error;
        }
        return toResponse(record);
      },

      async getBridgeStatus(requestId) {
        if (!online) {
          const error = new Error('Mock Bridge is offline.');
          error.type = 'network';
          error.request_id = requestId;
          throw error;
        }
        const records = readRecords();
        const record = getOwnedRecord(records, requestId);
        if (!record) return null;
        records[requestId] = record;
        writeRecords(records);
        return toResponse(record);
      },

      async getLatestBridge() {
        const records = readRecords();
        const latest = Object.values(records)
          .filter((record) => record.owner_id === ownerId)
          .map(expireIfNeeded)
          .sort((left, right) => right.created_ts - left.created_ts)[0] || null;
        if (!latest) return null;
        records[latest.request_id] = latest;
        writeRecords(records);
        return toResponse(latest);
      },

      async markTransferred(requestId) {
        return transition(requestId, 'transferred');
      },

      async markWaitingJoin(requestId) {
        return transition(requestId, 'waiting_join');
      },

      async bindMockUser(requestId, boundUserId = 'mock-guest-001') {
        return transition(requestId, 'bound', { bound_user_id: boundUserId });
      },

      async failBridge(requestId, error) {
        return transition(requestId, 'failed', { error });
      },

      setOnline(nextOnline) {
        online = Boolean(nextOnline);
      },

      getCreateCount: () => createCount,
      getBridgeRecord: (requestId) => {
        const records = readRecords();
        const record = getOwnedRecord(records, requestId);
        return record ? toResponse(record) : null;
      },
    });
  }

  const exported = { createMockInvites, TTL_SECONDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    globalScope.GhostLinkV3.createMockInvites = createMockInvites;
  }
})(typeof window !== 'undefined' ? window : globalThis);
