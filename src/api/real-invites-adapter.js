(function registerRealInvitesAdapter(globalScope) {
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

  function normalizeInvitation(raw, index = 0) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || raw.token || raw.invited_tg_id || `invite-${index + 1}`).trim();
    const rawStatus = String(raw.status || '').trim().toLowerCase();

    let status = 'pending';
    if (rawStatus === 'used' || rawStatus === 'paid' || rawStatus === 'subscribed') {
      status = 'subscribed';
    } else if (rawStatus === 'expired' || rawStatus === 'revoked') {
      status = 'expired';
    } else {
      status = 'pending';
    }

    let createdAt = raw.createdAt || '';
    if (!createdAt && raw.created_ts) {
      const date = new Date(Number(raw.created_ts) * 1000);
      createdAt = Number.isFinite(date.getTime()) ? date.toLocaleDateString('ru-RU') : '';
    }
    if (!createdAt) createdAt = 'Недавно';

    let name = String(raw.name || '').trim();
    if (!name) {
      if (raw.invited_tg_id) {
        name = `ID ${raw.invited_tg_id}`;
      } else if (raw.token) {
        name = `Инвайт ${String(raw.token).slice(0, 6)}`;
      } else {
        name = `Приглашение ${index + 1}`;
      }
    }

    return {
      id,
      name,
      handle: raw.handle ? String(raw.handle) : '',
      status,
      createdAt,
    };
  }

  function createRealInvitesAdapter(options = {}) {
    const apiBase = String(options.apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
    const fetchImpl = options.fetch || globalScope.fetch?.bind(globalScope);
    const getToken = options.getToken || (() => '');
    const profileSubscription = options.profileSubscription || null;
    const timeoutMs = Math.max(1, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);

    async function request(path, requestOptions = {}) {
      if (typeof fetchImpl !== 'function') throw createError('network', 'Сетевой клиент недоступен.');
      const token = String(getToken() || '').trim();
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      let timer;
      try {
        const headers = {
          Accept: 'application/json',
          ...(requestOptions.headers || {}),
        };
        if (token) {
          headers['X-PWA-Token'] = token;
        }
        if (globalScope.Telegram?.WebApp?.initData) {
          headers['X-Telegram-InitData'] = globalScope.Telegram.WebApp.initData;
        }
        const response = await Promise.race([
          fetchImpl(`${apiBase}${path}`, {
            ...requestOptions,
            signal: controller?.signal,
            headers,
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
        if (!response.ok) {
          throw createError('api', data?.detail || `api_error_${response.status}`, response.status, data);
        }
        return data;
      } catch (err) {
        if (err.type) throw err;
        throw createError('network', 'Ошибка соединения с сервером инвайтов.');
      } finally {
        if (timer) globalScope.clearTimeout(timer);
      }
    }

    function getProfileReferralLink() {
      const profile = profileSubscription?.getSnapshot?.() || profileSubscription?.getCachedProfile?.();
      return String(profile?.referral_link || profile?.user?.referral_link || profile?.profile?.referral_link || '').trim();
    }

    async function getSnapshot() {
      const referralLink = getProfileReferralLink();

      let data = null;
      try {
        data = await request('/api/invite/list', { method: 'GET', cache: 'no-store' });
      } catch (_) {
        // Gracefully fall back to profile link without failing the interface
        return {
          isMock: false,
          isUnavailable: true,
          standardInvitation: {
            type: 'standard',
            url: referralLink,
          },
          invitations: [],
          stats: {
            invited: 0,
            subscribed: 0,
            pending: 0,
            expired: 0,
            rewardDays: 0,
          },
        };
      }

      const rawItems = Array.isArray(data?.items) ? data.items : [];
      const invitations = rawItems.map(normalizeInvitation).filter(Boolean);

      const totals = invitations.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, { subscribed: 0, pending: 0, expired: 0 });

      const subscribedCount = Number(data?.used ?? totals.subscribed) || 0;
      const pendingCount = Number(data?.active ?? totals.pending) || 0;
      const expiredCount = Number((data?.expired || 0) + (data?.revoked || 0) || totals.expired) || 0;
      const totalInvited = Number(data?.total ?? invitations.length) || 0;
      const rewardDays = subscribedCount * 14;

      return {
        isMock: false,
        isUnavailable: false,
        standardInvitation: {
          type: 'standard',
          url: referralLink || data?.standardInvitation?.url || '',
        },
        invitations,
        stats: {
          invited: totalInvited,
          subscribed: subscribedCount,
          pending: pendingCount,
          expired: expiredCount,
          rewardDays,
        },
      };
    }

    async function getLatestBridge() {
      return null;
    }

    async function createBridge() {
      return { status: 'failed', error: { message: 'Режим Bridge находится в разработке 🚧' } };
    }

    async function markTransferred() {
      return null;
    }

    async function markWaitingJoin() {
      return null;
    }

    async function bindMockUser() {
      return null;
    }

    return Object.freeze({
      getSnapshot,
      getProfileReferralLink,
      getLatestBridge,
      createBridge,
      markTransferred,
      markWaitingJoin,
      bindMockUser,
    });
  }

  const exported = { createRealInvitesAdapter, normalizeInvitation };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    Object.assign(globalScope.GhostLinkV3, exported);
  }
})(typeof window !== 'undefined' ? window : globalThis);
