(function registerRealBlock1Adapter(globalScope) {
  const DEFAULT_API_BASE = 'https://api.112prd.ru:2053';
  const DEFAULT_FALLBACK_API_BASE = 'https://panel.112prd.ru:2053';
  const DEFAULT_TOTAL_TIMEOUT_MS = 15000;
  const DEFAULT_INIT_DATA_WAIT_MS = 6000;
  const DEFAULT_SESSION_TIMEOUT_MS = 12000;
  const DEFAULT_USER_TIMEOUT_MS = 12000;
  const DEFAULT_USER_RETRY_DELAY_MS = 250;
  const DEFAULT_USER_RETRY_TIMEOUT_MS = 5000;
  const DEFAULT_TARIFFS_TIMEOUT_MS = 10000;
  const DEFAULT_FAST_FALLBACK_TIMEOUT_MS = 2500;
  const INIT_DATA_RETRY_MS = 150;
  const DEFAULT_SESSION_RETRY_DELAY_MS = 500;
  const DEFAULT_SESSION_RETRY_TIMEOUT_MS = 5000;

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

  const DEFAULT_FALLBACK_TARIFFS = Object.freeze({
    tier: 'regular',
    pricing_group: 'regular',
    prices: Object.freeze({
      1: Object.freeze({ price: 150, min_pay: 100, max_discount: 50 }),
      2: Object.freeze({ price: 150, min_pay: 100, max_discount: 50 }),
      3: Object.freeze({ price: 350, min_pay: 200, max_discount: 150 }),
      4: Object.freeze({ price: 450, min_pay: 250, max_discount: 200 }),
      5: Object.freeze({ price: 500, min_pay: 300, max_discount: 200 }),
    }),
    period_prices: Object.freeze({
      1: Object.freeze({
        1: Object.freeze({ price: 150, min_pay: 100, max_discount: 50 }),
        2: Object.freeze({ price: 150, min_pay: 100, max_discount: 50 }),
        3: Object.freeze({ price: 350, min_pay: 200, max_discount: 150 }),
        4: Object.freeze({ price: 450, min_pay: 250, max_discount: 200 }),
        5: Object.freeze({ price: 500, min_pay: 300, max_discount: 200 }),
      }),
      2: Object.freeze({
        1: Object.freeze({ price: 290, min_pay: 180, max_discount: 110 }),
        2: Object.freeze({ price: 290, min_pay: 180, max_discount: 110 }),
        3: Object.freeze({ price: 630, min_pay: 360, max_discount: 270 }),
        4: Object.freeze({ price: 810, min_pay: 450, max_discount: 360 }),
        5: Object.freeze({ price: 900, min_pay: 540, max_discount: 360 }),
      }),
      3: Object.freeze({
        1: Object.freeze({ price: 430, min_pay: 240, max_discount: 190 }),
        2: Object.freeze({ price: 430, min_pay: 240, max_discount: 190 }),
        3: Object.freeze({ price: 840, min_pay: 480, max_discount: 360 }),
        4: Object.freeze({ price: 1080, min_pay: 600, max_discount: 480 }),
        5: Object.freeze({ price: 1200, min_pay: 720, max_discount: 480 }),
      }),
    }),
    solo: Object.freeze({ price: 150, min_pay: 100, max_discount: 50 }),
    flex: Object.freeze({
      2: Object.freeze({ price: 150, min_pay: 100, max_discount: 50 }),
      3: Object.freeze({ price: 350, min_pay: 200, max_discount: 150 }),
      4: Object.freeze({ price: 450, min_pay: 250, max_discount: 200 }),
      5: Object.freeze({ price: 500, min_pay: 300, max_discount: 200 }),
    }),
  });

  function createError(type, message, status, data) {
    const error = new Error(message || type);
    error.type = type;
    if (status) error.status = status;
    if (data !== undefined) error.data = data;
    return error;
  }

  function normaliseApiBase(value) {
    return String(value || DEFAULT_API_BASE).replace(/\/+$/, '');
  }

  function toInteger(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
  }

  async function requestJson(fetchImpl, url, options, timeoutMs) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timedOut = false;
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = globalScope.setTimeout(() => {
        timedOut = true;
        controller?.abort();
        reject(createError('timeout', 'Сервер отвечает слишком долго. Попробуйте ещё раз.'));
      }, Math.max(1, timeoutMs));
    });

    try {
      const response = await Promise.race([
        fetchImpl(url, { ...options, signal: controller?.signal }),
        timeoutPromise,
      ]);
      const raw = await Promise.race([response.text(), timeoutPromise]);
      let data;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (_) {
        throw createError('invalid_json', 'Сервер вернул некорректные данные.', response.status);
      }

      if (response.status === 401) {
        throw createError('auth', data?.detail || 'Требуется открыть Mini App через Telegram.', response.status, data);
      }
      if (response.status === 403) {
        const detail = String(data?.detail || '').trim();
        const type = detail === 'profile_not_ready' ? 'profile_not_ready' : 'access_denied';
        const message = type === 'profile_not_ready'
          ? 'Профиль ещё готовится. Вернитесь в бота и откройте Mini App после подтверждения заявки.'
          : (detail || 'Доступ к профилю закрыт.');
        throw createError(type, message, response.status, data);
      }
      if (!response.ok) {
        throw createError('api', data?.detail || `api_error_${response.status}`, response.status, data);
      }
      if (!data || typeof data !== 'object') {
        throw createError('invalid_json', 'Сервер вернул пустой ответ.', response.status);
      }
      return data;
    } catch (error) {
      if (error?.type) throw error;
      if (timedOut || error?.name === 'AbortError') {
        throw createError('timeout', 'Сервер отвечает слишком долго. Попробуйте ещё раз.');
      }
      throw createError('network', 'Не удалось связаться с GhostLink. Проверьте подключение.');
    } finally {
      if (timeoutId) globalScope.clearTimeout(timeoutId);
    }
  }

  function getErrorStatus(error) {
    if (Number.isFinite(Number(error?.status))) return Number(error.status);
    return error?.type || 'error';
  }

  function tariffEmoji(tariffName, memberTier, timeless) {
    const identity = `${tariffName} ${memberTier}`.toLowerCase();
    if (timeless || identity.includes('vip')) return '💎';
    if (identity.includes('flex')) return '⚡';
    if (identity.includes('trial') || identity.includes('пробн') || identity.includes('подар') || identity.includes('gift') || identity.includes('конкурс')) return '🎁';
    if (identity.includes('solo')) return '👻';
    return '👻';
  }

  function daysUntilExpiry(expiry, currentDate) {
    const expiryMs = new Date(expiry).getTime();
    const currentMs = new Date(currentDate).getTime();
    if (!Number.isFinite(expiryMs) || !Number.isFinite(currentMs)) return null;
    return Math.max(0, Math.ceil((expiryMs - currentMs) / 86400000));
  }

  function mapProfile(userResponse, tariffsResponse, currentDate = new Date()) {
    const user = userResponse?.user;
    const subscription = userResponse?.subscription;
    if (!user || !subscription || typeof subscription !== 'object') {
      throw createError('profile_not_ready', 'Профиль ещё не готов. Попробуйте обновить через несколько секунд.');
    }

    const subscriptionStatus = String(subscription.status || '').trim().toLowerCase();
    const responseStatus = String(userResponse.status || '').trim().toLowerCase();
    const memberTier = String(userResponse.member_tier ?? subscription.member_tier ?? '').trim().toLowerCase();
    const rawExpiry = subscription.expiry || userResponse.expiry;
    const isVip = subscriptionStatus === 'vip' || responseStatus === 'vip' || memberTier === 'vip';
    const rawTariffName = String(userResponse.tariff_name || subscription.tariff_name || '').trim();
    const normTariff = rawTariffName.toLowerCase();
    const isGift = normTariff === 'gift'
      || normTariff === 'подарок'
      || normTariff === 'подарочный'
      || normTariff.includes('подар');

    // Бессрочный ТОЛЬКО если это VIP И у него НЕТ даты окончания в базе
    const isTimeless = isVip && !rawExpiry;
    const status = isTimeless ? 'vip' : (subscriptionStatus || responseStatus);

    const rawDaysLeft = subscription.days_left ?? userResponse.days_left;
    const remainingDays = isTimeless 
      ? null 
      : (rawDaysLeft === null || rawDaysLeft === undefined
        ? (isGift && rawExpiry ? daysUntilExpiry(rawExpiry, currentDate) : null)
        : toInteger(rawDaysLeft));

    // Активность: бессрочный активен всегда, датированный активен ТОЛЬКО пока remainingDays > 0
    const active = isTimeless
      ? true
      : Boolean(subscription.active) && remainingDays !== null && remainingDays > 0;

    const state = status === 'pending'
      ? 'pending'
      : (isTimeless ? 'vip' : (active ? (status || 'active') : 'expired'));
    const rawTotalDays = subscription.total_days ?? userResponse.total_days;
    const totalDays = rawTotalDays === null || rawTotalDays === undefined
      ? null
      : toInteger(rawTotalDays);
    const startedAt = subscription.started_at ?? userResponse.started_at ?? null;

    let tariffName = '';
    const isTrial = subscriptionStatus === 'trial'
      || responseStatus === 'trial'
      || normTariff === 'trial'
      || normTariff === 'trial_7d'
      || normTariff === 'trial-7d'
      || normTariff.includes('пробн');

    if (isVip) {
      tariffName = 'VIP';
    } else if (isGift) {
      tariffName = 'ПОДАРОЧНЫЙ';
    } else if (isTrial) {
      tariffName = 'ПРОБНЫЙ ПЕРИОД';
    } else if (rawTariffName) {
      tariffName = rawTariffName;
    } else if (active) {
      tariffName = 'SOLO';
    } else {
      tariffName = memberTier ? memberTier.toUpperCase() : '';
    }

    const planId = isVip
      ? 'vip'
      : (isGift
        ? 'gift'
        : (isTrial
          ? 'trial'
          : (tariffName ? tariffName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : (active ? 'solo' : 'ghostlink'))));

    const userIsAdmin = Boolean(user.is_admin ?? userResponse.is_admin ?? false);
    let rawSubToken = userResponse.sub_token || user.sub_token || subscription.sub_token || userResponse.subToken || user.subToken || '';
    if (!rawSubToken) {
      const subUrlCandidate = userResponse.subscription_url || subscription.subscription_url || userResponse.subscription_link || subscription.subscription_link || userResponse.sub_url || subscription.sub_url || '';
      if (typeof subUrlCandidate === 'string') {
        const match = subUrlCandidate.match(/\/sub\/([A-Za-z0-9_-]+)/);
        if (match) rawSubToken = match[1];
      }
    }
    const subToken = (typeof rawSubToken === 'string' && !/^[a-f0-9]{64}$/i.test(rawSubToken.trim())) ? rawSubToken.trim() : '';
    const rawUrl = userResponse.subscription_url || subscription.subscription_url || userResponse.url || subscription.url || user.subscription_url || user.url || '';
    const subscriptionUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    const rawUrlIncy = userResponse.url_incy || subscription.url_incy || user.url_incy || userResponse.subscription_url_incy || subscription.subscription_url_incy || '';
    const urlIncy = typeof rawUrlIncy === 'string' ? rawUrlIncy.trim() : '';
    const paymentStatus = userResponse.payment_status || subscription.payment_status || null;
    const paymentRequestId = userResponse.payment_request_id || subscription.payment_request_id || userResponse.request_id || subscription.request_id || null;
    const paymentAmount = userResponse.payment_amount ?? subscription.payment_amount ?? null;
    const paymentSender = userResponse.payment_sender || subscription.payment_sender || '';
    const paymentLabel = userResponse.payment_label || subscription.payment_label || '';
    const paymentTimeMsk = userResponse.payment_time_msk || subscription.payment_time_msk || '';
    const paymentTs = userResponse.payment_ts || subscription.payment_ts || 0;
    const rawReferralLink = userResponse.referral_link || subscription.referral_link || '';
    const referralLink = typeof rawReferralLink === 'string' ? rawReferralLink.trim() : '';

    return {
      isMock: false,
      user: {
        id: String(user.id || ''),
        name: String(user.name || user.username || ''),
        is_admin: userIsAdmin,
        sub_token: subToken,
        token: subToken,
        subscription_url: subscriptionUrl,
        url: subscriptionUrl,
        url_incy: urlIncy,
        referral_link: referralLink,
      },
      profile: {
        id: String(user.id || ''),
        displayName: String(user.name || user.username || ''),
        access: active ? 'granted' : state,
        isAdmin: userIsAdmin,
        is_admin: userIsAdmin,
        sub_token: subToken,
        token: subToken,
        subscription_url: subscriptionUrl,
        url: subscriptionUrl,
        url_incy: urlIncy,
        referral_link: referralLink,
        payment_status: paymentStatus,
        payment_request_id: paymentRequestId,
        payment_amount: paymentAmount,
        payment_sender: paymentSender,
        payment_label: paymentLabel,
        payment_time_msk: paymentTimeMsk,
      },
      sub_token: subToken,
      token: subToken,
      subscription_url: subscriptionUrl,
      url: subscriptionUrl,
      url_incy: urlIncy,
      referral_link: referralLink,
      connected_devices: toInteger(userResponse.connected_devices),
      device_limit: toInteger(userResponse.device_limit),
      usedDevices: toInteger(userResponse.connected_devices),
      deviceLimit: toInteger(userResponse.device_limit),
      payment_status: paymentStatus,
      payment_request_id: paymentRequestId,
      payment: {
        status: paymentStatus,
        request_id: paymentRequestId,
        payment_request_id: paymentRequestId,
        amount: paymentAmount,
        sender: paymentSender,
        label: paymentLabel,
        timeMsk: paymentTimeMsk,
        ts: paymentTs,
      },
      subscription: {
        state,
        active,
        payment_status: paymentStatus,
        payment_request_id: paymentRequestId,
        payment_amount: paymentAmount,
        payment_sender: paymentSender,
        payment_label: paymentLabel,
        payment_time_msk: paymentTimeMsk,
        plan: {
          id: planId,
          title: tariffName,
          emoji: tariffEmoji(tariffName || rawTariffName, memberTier, isTimeless || isVip),
        },
        totalDays,
        startedAt,
        remainingDays,
        expiry: isTimeless ? null : (subscription.expiry || userResponse.expiry || null),
        isTimeless,
        deviceLimit: toInteger(userResponse.device_limit),
        usedDevices: toInteger(userResponse.connected_devices),
      },
      tariffs: tariffsResponse || DEFAULT_FALLBACK_TARIFFS,
    };
  }

  function createRealBlock1Adapter(options = {}) {
    const primaryApiBase = normaliseApiBase(options.apiBase);
    const fallbackApiBase = options.fallbackApiBase !== undefined
      ? normaliseApiBase(options.fallbackApiBase)
      : (primaryApiBase === DEFAULT_API_BASE ? DEFAULT_FALLBACK_API_BASE : '');
    let activeApiBase = primaryApiBase;
    const apiBase = primaryApiBase;
    const fetchImpl = options.fetch || globalScope.fetch?.bind(globalScope);
    const getInitData = options.getInitData || (() => globalScope.Telegram?.WebApp?.initData || '');
    const now = options.now || (() => new Date());
    const nowMs = options.nowMs || (() => Date.now());
    const sleep = options.sleep || ((duration) => new Promise((resolve) => globalScope.setTimeout(resolve, duration)));
    const totalTimeoutMs = toInteger(options.totalTimeoutMs ?? options.timeoutMs, DEFAULT_TOTAL_TIMEOUT_MS) || DEFAULT_TOTAL_TIMEOUT_MS;
    const initDataWaitMs = toInteger(options.initDataWaitMs, DEFAULT_INIT_DATA_WAIT_MS) || DEFAULT_INIT_DATA_WAIT_MS;
    const sessionTimeoutMs = toInteger(options.sessionTimeoutMs, DEFAULT_SESSION_TIMEOUT_MS) || DEFAULT_SESSION_TIMEOUT_MS;
    const userTimeoutMs = toInteger(options.userTimeoutMs, DEFAULT_USER_TIMEOUT_MS) || DEFAULT_USER_TIMEOUT_MS;
    const userRetryDelayMs = options.userRetryDelayMs !== undefined
      ? toInteger(options.userRetryDelayMs, DEFAULT_USER_RETRY_DELAY_MS)
      : DEFAULT_USER_RETRY_DELAY_MS;
    const userRetryTimeoutMs = options.userRetryTimeoutMs !== undefined
      ? toInteger(options.userRetryTimeoutMs, DEFAULT_USER_RETRY_TIMEOUT_MS)
      : DEFAULT_USER_RETRY_TIMEOUT_MS;
    const tariffsTimeoutMs = toInteger(options.tariffsTimeoutMs, DEFAULT_TARIFFS_TIMEOUT_MS) || DEFAULT_TARIFFS_TIMEOUT_MS;
    const fallbackThresholdMs = toInteger(options.fallbackThresholdMs, DEFAULT_FAST_FALLBACK_TIMEOUT_MS) || DEFAULT_FAST_FALLBACK_TIMEOUT_MS;
    const sessionRetryDelayMs = options.sessionRetryDelayMs !== undefined
      ? toInteger(options.sessionRetryDelayMs, DEFAULT_SESSION_RETRY_DELAY_MS)
      : DEFAULT_SESSION_RETRY_DELAY_MS;
    const sessionRetryTimeoutMs = options.sessionRetryTimeoutMs !== undefined
      ? toInteger(options.sessionRetryTimeoutMs, DEFAULT_SESSION_RETRY_TIMEOUT_MS)
      : DEFAULT_SESSION_RETRY_TIMEOUT_MS;
    let token = '';
    let inFlight = null;
    let sessionState = null;
    let diagnostics = null;

    if (typeof fetchImpl !== 'function') {
      throw createError('network', 'Браузер не поддерживает сетевые запросы.');
    }

    async function requestJsonWithFallback(path, reqOptions, timeoutMs) {
      const firstBase = activeApiBase;
      if (!fallbackApiBase || activeApiBase === fallbackApiBase) {
        return requestJson(fetchImpl, `${firstBase}${path}`, reqOptions, timeoutMs);
      }

      let fallbackStarted = false;
      let fallbackPromise = null;

      function triggerFallback() {
        if (fallbackStarted) return fallbackPromise;
        fallbackStarted = true;
        fallbackPromise = requestJson(fetchImpl, `${fallbackApiBase}${path}`, reqOptions, timeoutMs)
          .then((res) => {
            activeApiBase = fallbackApiBase;
            return res;
          });
        return fallbackPromise;
      }

      const thresholdMs = Math.min(timeoutMs, fallbackThresholdMs);
      let thresholdTimer = null;
      const thresholdPromise = new Promise((resolve) => {
        thresholdTimer = globalScope.setTimeout(() => {
          resolve('threshold_timeout');
        }, thresholdMs);
      });

      const primaryPromise = requestJson(fetchImpl, `${firstBase}${path}`, reqOptions, timeoutMs);

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

    function createDiagnostics() {
      return {
        initData_present: false,
        session_status: 'not_started',
        user_status: 'not_started',
        tariffs_status: 'not_started',
        durations_ms: {},
      };
    }

    async function waitForInitData() {
      const initDataDeadline = nowMs() + initDataWaitMs;

      while (nowMs() < initDataDeadline) {
        const initData = String(getInitData() || '').trim();
        if (initData) {
          diagnostics.initData_present = true;
          return initData;
        }
        await sleep(Math.max(1, Math.min(INIT_DATA_RETRY_MS, initDataDeadline - nowMs())));
      }

      const initData = String(getInitData() || '').trim();
      if (initData) {
        diagnostics.initData_present = true;
        return initData;
      }
      throw createError('auth', 'Telegram ещё не передал данные входа. Закройте и откройте Mini App ещё раз.', 401);
    }

    async function runStage(name, timeoutMs, request, stageDiagnostics = diagnostics) {
      const startedAt = nowMs();
      try {
        const result = await request(timeoutMs);
        stageDiagnostics[`${name}_status`] = 200;
        return result;
      } catch (error) {
        stageDiagnostics[`${name}_status`] = getErrorStatus(error);
        throw error;
      } finally {
        stageDiagnostics.durations_ms[name] = Math.max(0, nowMs() - startedAt);
      }
    }

    function isRetryableUserReadError(error) {
      if (error?.type === 'network' || error?.type === 'timeout' || error?.type === 'invalid_json') return true;
      return error?.type === 'api' && Number(error?.status) >= 500;
    }

    async function readUserWithRetry(currentGeneration, requestDiagnostics) {
      const startedAt = nowMs();
      const readUser = (timeoutMs) => requestJsonWithFallback('/api/user', {
        method: 'GET', cache: 'no-store', credentials: 'include', headers: readHeaders(),
      }, timeoutMs);

      try {
        return await runStage('user', userTimeoutMs, readUser, requestDiagnostics);
      } catch (firstError) {
        if (currentGeneration !== activeGeneration && latestUserResponse) return latestUserResponse;
        if (!isRetryableUserReadError(firstError)) throw firstError;
        if (userRetryDelayMs > 0) await sleep(userRetryDelayMs);
        if (currentGeneration !== activeGeneration && latestUserResponse) return latestUserResponse;
        return runStage('user', userRetryTimeoutMs, readUser, requestDiagnostics);
      } finally {
        requestDiagnostics.durations_ms.user = Math.max(0, nowMs() - startedAt);
      }
    }

    async function openSession(currentGeneration) {
      const initData = await waitForInitData();

      const doSessionRequest = (timeoutMs) => requestJsonWithFallback('/api/miniapp/session', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams({ init_data: initData }),
      }, timeoutMs);

      let session;
      try {
        session = await runStage('session', sessionTimeoutMs, doSessionRequest);
      } catch (firstError) {
        if (firstError?.status === 401 || firstError?.status === 403 || firstError?.type === 'auth') {
          throw firstError;
        }
        const delay = sessionRetryDelayMs;
        if (delay > 0) {
          await sleep(delay);
        }
        session = await runStage('session', sessionRetryTimeoutMs, doSessionRequest);
      }

      const receivedToken = String(session?.session_token || '').trim();
      if (receivedToken) {
        if (!token || currentGeneration === activeGeneration) {
          token = receivedToken;
          sessionState = Object.freeze({ status: 'authenticated', transport: 'memory' });
        }
      } else if (!token) {
        throw createError('invalid_json', 'Сервер не подтвердил сессию.');
      }

      return session;
    }

    const defaultTariffs = options.defaultTariffs || options.fallbackTariffs || DEFAULT_FALLBACK_TARIFFS;
    const listeners = new Set();
    let currentSnapshot = {
      user: null,
      profile: null,
      subscription: null,
      tariffs: defaultTariffs,
    };
    let latestTariffsResponse = null;
    let latestUserResponse = null;
    let tariffsInFlight = null;
    let activeGeneration = 0;

    function subscribe(callback) {
      if (typeof callback === 'function') {
        listeners.add(callback);
        if (currentSnapshot) {
          try { callback(currentSnapshot); } catch (_) {}
        }
        return () => listeners.delete(callback);
      }
      return () => {};
    }

    function notifyListeners(snapshot) {
      listeners.forEach((cb) => {
        try { cb(snapshot); } catch (_) {}
      });
    }

    function readHeaders() {
      return { Accept: 'application/json', 'X-PWA-Token': token };
    }

    return Object.freeze({
      fetchProfileSubscription(options = {}) {
        if (inFlight && !options?.force) return inFlight;
        const currentGeneration = ++activeGeneration;
        inFlight = (async () => {
          diagnostics = createDiagnostics();
          const requestDiagnostics = diagnostics;

          if (!token || options?.reauth) {
            await openSession(currentGeneration);
          } else {
            requestDiagnostics.initData_present = true;
            requestDiagnostics.session_status = 200;
          }

          let user;
          try {
            user = await readUserWithRetry(currentGeneration, requestDiagnostics);
          } catch (userError) {
            if (currentGeneration !== activeGeneration && currentSnapshot?.user) return currentSnapshot;
            if (userError?.status === 401) {
              token = '';
              sessionState = null;
              await openSession(currentGeneration);
              user = await readUserWithRetry(currentGeneration, requestDiagnostics);
            } else {
              throw userError;
            }
          }

          if (!user) {
            return currentSnapshot?.user ? currentSnapshot : null;
          }

          const hasNewerData = Boolean(currentGeneration !== activeGeneration && latestUserResponse);
          if (!hasNewerData) {
            latestUserResponse = user;
            const profileResult = mapProfile(user, null, now());
            profileResult.tariffs = latestTariffsResponse || currentSnapshot?.tariffs || defaultTariffs;
            currentSnapshot = profileResult;
            notifyListeners(profileResult);
          }

          // Fallback tariffs are already present in the profile snapshot. Refresh
          // them only after the primary session and profile are confirmed.
          tariffsInFlight = runStage('tariffs', tariffsTimeoutMs, (timeoutMs) => requestJsonWithFallback('/api/tariffs', {
            method: 'GET', cache: 'no-store', credentials: 'include', headers: readHeaders(),
          }, timeoutMs), requestDiagnostics).then((tariffsData) => {
            if (currentGeneration !== activeGeneration && latestTariffsResponse) return;
            if (tariffsData) {
              latestTariffsResponse = tariffsData;
              currentSnapshot.tariffs = tariffsData;
              notifyListeners(currentSnapshot);
            }
          }).catch(() => {
            // Preserve the fallback matrix when the optional refresh fails.
          });

          return currentSnapshot;
        })().finally(() => {
          if (currentGeneration === activeGeneration) {
            inFlight = null;
          }
        });
        return inFlight;
      },
      async refresh(options = {}) {
        const result = await this.fetchProfileSubscription({ force: true, ...options });
        if (tariffsInFlight) await tariffsInFlight;
        if (result && latestTariffsResponse && result === currentSnapshot) {
          currentSnapshot.tariffs = latestTariffsResponse;
          notifyListeners(currentSnapshot);
        }
        return result;
      },
      getSnapshot: () => currentSnapshot,
      getCachedProfile: () => currentSnapshot,
      subscribe,
      onUpdate: subscribe,
      getSession: () => sessionState ? { ...sessionState } : null,
      getToken: () => token,
      getSubToken: () => currentSnapshot?.user?.sub_token || currentSnapshot?.sub_token || '',
      getApiBase: () => activeApiBase,
      getDiagnostics: () => diagnostics ? {
        ...diagnostics,
        durations_ms: { ...diagnostics.durations_ms },
      } : null,
    });
  }

  const exported = { createRealBlock1Adapter, mapProfile, DEFAULT_FALLBACK_TARIFFS };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    Object.assign(globalScope.GhostLinkV3, exported);
  }
})(typeof window !== 'undefined' ? window : globalThis);
