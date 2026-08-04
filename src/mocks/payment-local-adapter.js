(function registerMockPaymentAdapter(globalScope) {
  const STORAGE_KEY = 'ghostlink-v3-mock-payment-requests-v1';
  const VALID_STATUSES = new Set(['pending_verification', 'approved', 'rejected', 'expired', 'cancelled']);

  function createMemoryStorage() {
    const values = new Map();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    };
  }

  function createMockPaymentAdapter(options = {}) {
    let storage = options.storage || null;
    if (!storage) {
      try {
        storage = globalScope?.localStorage || null;
      } catch {
        storage = null;
      }
    }
    const sessionStorage = options.sessionStorage || createMemoryStorage();
    const now = options.now || (() => new Date().toISOString());
    let online = options.online !== false;
    let submitCount = 0;

    function readRecords() {
      try {
        const sessionVal = sessionStorage.getItem(STORAGE_KEY);
        if (sessionVal) return JSON.parse(sessionVal);
      } catch {
        // Fallback
      }
      try {
        const persisted = storage?.getItem(STORAGE_KEY);
        return persisted ? JSON.parse(persisted) : {};
      } catch {
        // SecurityError expected in restrictive WebViews
        return {};
      }
    }

    function writeRecords(records) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch {
        // Fallback
      }
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch {
        // Fallback
      }
    }

    function maskPayerName(name) {
      if (!name) return 'Пользователь';
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0]} ${parts[1][0]}.`;
      }
      return parts[0];
    }

    function sanitizeRecord(rec) {
      return {
        paymentRequestId: rec.paymentRequestId,
        planId: rec.planId,
        amount: rec.amount,
        payerName: rec.payerName,
        bankKey: rec.bankKey,
        status: rec.status,
        ownerId: rec.ownerId,
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
        rejectReason: rec.rejectReason || null,
      };
    }

    return Object.freeze({
      async submitPayment({ requestId, planId, amount, payerName, bankKey = 'tbank', ownerId = 'user-default', scenario = 'success' } = {}) {
        if (!online) {
          const error = new Error('Mock payment adapter is offline.');
          error.type = 'network';
          throw error;
        }
        if (scenario === 'timeout') {
          const error = new Error('Mock payment submission timed out.');
          error.type = 'timeout';
          throw error;
        }

        if (!planId || !amount || amount <= 0 || !payerName || !payerName.trim()) {
          return {
            status: 'failed',
            code: 'invalid_data',
            message: 'Укажите корректные данные для оплаты.',
          };
        }

        const records = readRecords();
        const paymentRequestId = requestId || `pay_req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        // Idempotency: duplicate submission of exact same requestId
        if (records[paymentRequestId]) {
          const existing = records[paymentRequestId];
          if (existing.ownerId !== ownerId) {
            return { status: 'failed', code: 'request_forbidden', message: 'Доступ запрещён.' };
          }
          return {
            ...sanitizeRecord(existing),
            status: 'conflict',
            code: 'request_conflict',
            message: 'Заявка с таким ID уже зарегистрирована.',
          };
        }

        // Active pending verification check for the same owner
        const activePending = Object.values(records).find(
          (rec) => rec.ownerId === ownerId && rec.status === 'pending_verification'
        );
        if (activePending) {
          return {
            paymentRequestId: activePending.paymentRequestId,
            status: 'conflict',
            code: 'pending_payment_exists',
            message: 'У вас уже есть активная заявка на проверку.',
          };
        }

        submitCount += 1;
        const newRecord = {
          paymentRequestId,
          planId,
          amount: Number(amount),
          payerName: maskPayerName(payerName),
          bankKey,
          ownerId,
          status: 'pending_verification',
          createdAt: now(),
          updatedAt: now(),
        };

        records[paymentRequestId] = newRecord;
        writeRecords(records);

        return sanitizeRecord(newRecord);
      },

      async getPaymentStatus(paymentRequestId, { ownerId = 'user-default' } = {}) {
        if (!online) {
          const error = new Error('Mock payment adapter is offline.');
          error.type = 'network';
          throw error;
        }

        const records = readRecords();
        const rec = records[paymentRequestId];
        if (!rec) return null;
        if (ownerId && rec.ownerId !== ownerId) {
          return { status: 'failed', code: 'request_forbidden', message: 'Доступ запрещён.' };
        }
        return sanitizeRecord(rec);
      },

      async getActivePaymentForUser(ownerId = 'user-default') {
        if (!online) {
          const error = new Error('Mock payment adapter is offline.');
          error.type = 'network';
          throw error;
        }
        const records = readRecords();
        const active = Object.values(records).find(
          (rec) => rec.ownerId === ownerId && ['pending_verification', 'approved', 'rejected', 'expired'].includes(rec.status)
        );
        return active ? sanitizeRecord(active) : null;
      },

      async cancelPayment(paymentRequestId, { ownerId = 'user-default' } = {}) {
        if (!online) {
          const error = new Error('Mock payment adapter is offline.');
          error.type = 'network';
          throw error;
        }
        const records = readRecords();
        const rec = records[paymentRequestId];
        if (!rec) return null;
        if (rec.ownerId !== ownerId) {
          return { status: 'failed', code: 'request_forbidden', message: 'Вы не можете отменить чужую заявку.' };
        }
        if (rec.status !== 'pending_verification') {
          return { status: 'failed', code: 'invalid_state', message: 'Отменить можно только заявку в статусе ожидания.' };
        }

        rec.status = 'cancelled';
        rec.updatedAt = now();
        records[paymentRequestId] = rec;
        writeRecords(records);
        return sanitizeRecord(rec);
      },

      // Admin contour methods
      async approvePayment(paymentRequestId) {
        const records = readRecords();
        const rec = records[paymentRequestId];
        if (!rec) return null;
        rec.status = 'approved';
        rec.updatedAt = now();
        records[paymentRequestId] = rec;
        writeRecords(records);
        return sanitizeRecord(rec);
      },

      async rejectPayment(paymentRequestId, { reason = 'Неверные реквизиты' } = {}) {
        const records = readRecords();
        const rec = records[paymentRequestId];
        if (!rec) return null;
        rec.status = 'rejected';
        rec.rejectReason = reason;
        rec.updatedAt = now();
        records[paymentRequestId] = rec;
        writeRecords(records);
        return sanitizeRecord(rec);
      },

      async expirePayment(paymentRequestId) {
        const records = readRecords();
        const rec = records[paymentRequestId];
        if (!rec) return null;
        rec.status = 'expired';
        rec.updatedAt = now();
        records[paymentRequestId] = rec;
        writeRecords(records);
        return sanitizeRecord(rec);
      },

      setOnline(nextOnline) {
        online = Boolean(nextOnline);
      },

      getSubmitCount: () => submitCount,
    });
  }

  const exported = { createMockPaymentAdapter };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    globalScope.GhostLinkV3.createMockPaymentAdapter = createMockPaymentAdapter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
