(() => {
const root = typeof window !== 'undefined' ? window : globalThis;
const GhostLinkV3 = root.GhostLinkV3 = root.GhostLinkV3 || {};

const BANK_NAMES = {
  tbank: 'Т-Банк',
  tinkoff: 'Т-Банк',
  alfa: 'Альфа-Банк',
  alfabank: 'Альфа-Банк',
  sber: 'Сбербанк',
  sberbank: 'Сбербанк',
  ozon: 'Озон-банк',
  ozonbank: 'Озон-банк',
  vtb: 'ВТБ',
};

function formatBankName(rawBank) {
  if (!rawBank) return 'Т-Банк';
  const key = String(rawBank).toLowerCase().replace(/[^a-zа-я0-9]/g, '');
  return BANK_NAMES[key] || rawBank;
}

function isValidPayerName(value) {
  return /^\p{L}{2,}(?:[\s-]+\p{L}{1,}\.?)+$/u.test(String(value || '').trim());
}

function generateUuidV4() {
  if (typeof root.crypto?.randomUUID === 'function') {
    return root.crypto.randomUUID();
  }
  if (typeof root.crypto?.getRandomValues === 'function') {
    const buf = new Uint8Array(16);
    root.crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40; // Version 4
    buf[8] = (buf[8] & 0x3f) | 0x80; // Variant RFC4122
    const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isValidPrice(val) {
  if (typeof val === 'boolean' || val === null || val === undefined) return false;
  const num = Number(val);
  return Number.isFinite(num) && num > 0 && Math.floor(num) === num;
}

function getTariffPrice(totalDev, months, snapshot) {
  const tariffs = snapshot?.tariffs;
  const rawPeriodPrice = tariffs?.period_prices?.[months]?.[totalDev]?.price;
  if (isValidPrice(rawPeriodPrice)) {
    return Number(rawPeriodPrice);
  }
  if (months === 1) {
    const rawFlexPrice = tariffs?.flex?.[totalDev]?.price;
    if (isValidPrice(rawFlexPrice)) {
      return Number(rawFlexPrice);
    }
    if (totalDev <= 2) {
      const rawSoloPrice = tariffs?.solo?.price;
      if (isValidPrice(rawSoloPrice)) {
        return Number(rawSoloPrice);
      }
    }
  }
  return null;
}

GhostLinkV3.isValidPrice = isValidPrice;
GhostLinkV3.getTariffPrice = getTariffPrice;

GhostLinkV3.initSubscriptionModule = function initSubscriptionModule(dependencies = {}) {

  const {
    showToast = () => {},
    copyText = () => Promise.resolve(true),
    openOverlay = () => {},
    closeOverlay = () => {},
    returnToHome = () => {},
    profileSubscription,
    fetch: customFetch,
    apiBase: customApiBase,
    getInitData: customGetInitData,
  } = dependencies;

  const DEFAULT_API_BASE = 'https://api.112prd.ru';
  const apiBase = (customApiBase || profileSubscription?.getApiBase?.() || DEFAULT_API_BASE).replace(/\/+$/, '');
  const fetchImpl = customFetch || (typeof fetch !== 'undefined' ? fetch.bind(root) : root.fetch?.bind(root));
  const getInitData = customGetInitData || (() => root.Telegram?.WebApp?.initData || '');

  // DOM Elements
  const bentoExtend = document.querySelector('.bento-extend');
  const pageExtend = document.getElementById('page-extend');
  const btnExtendBack = document.getElementById('btn-extend-back');

  const btnPay = document.getElementById('btn-pay');
  const pageCheckout = document.getElementById('page-checkout');
  const btnCheckoutBack = document.getElementById('btn-checkout-back');

  const checkoutFormView = document.getElementById('checkout-form-view');
  const checkoutPendingView = document.getElementById('checkout-pending-view');
  const checkoutApprovedView = document.getElementById('checkout-approved-view');
  const checkoutRejectedView = document.getElementById('checkout-rejected-view');
  const btnPendingHome = document.getElementById('btn-pending-home');
  const btnApprovedHome = document.getElementById('btn-approved-home');

  const btnCopyPhone = document.getElementById('btn-copy-phone');
  const btnSubmitPayment = document.getElementById('btn-submit-payment');
  const btnRetryPayment = document.getElementById('btn-retry-payment');
  const payerNameInput = document.getElementById('payer-name-input');
  const reqBankName = document.getElementById('req-bank-name');
  const reqPhoneNum = document.getElementById('req-phone-num');
  const reqRecipientName = document.getElementById('req-recipient-name');
  const pendingPlanEl = document.getElementById('pending-plan-val');
  const pendingAmountEl = document.getElementById('pending-amount-val');
  const pendingBankEl = document.getElementById('pending-bank-val');
  const pendingPayerEl = document.getElementById('pending-payer-val');
  const pendingTimeEl = document.getElementById('pending-time-val');
  const approvedPlanEl = document.getElementById('approved-plan-val');
  const approvedAmountEl = document.getElementById('approved-amount-val');
  const approvedDevEl = document.getElementById('approved-dev-val');
  const rejectedPlanEl = document.getElementById('rejected-plan-val');
  const rejectedAmountEl = document.getElementById('rejected-amount-val');
  const rejectedPayerEl = document.getElementById('rejected-payer-val');
  const confirmationNameDot = document.getElementById('confirmation-name-dot');
  const confirmationNameText = document.getElementById('confirmation-name-text');
  const confirmationBankName = document.getElementById('confirmation-bank-name');
  const paymentConfig = root.GhostLinkPaymentConfig;

  let currentPaymentRequest = null;
  let currentPaymentRequestId = null;
  let liveRequisitesLoaded = false;
  let settingsPromise = null;
  let pendingPollTimer = null;

  function startPendingPolling() {
    if (pendingPollTimer) return;
    pendingPollTimer = setInterval(async () => {
      if (!profileSubscription?.fetchProfileSubscription) return;
      try {
        const freshProfile = await profileSubscription.fetchProfileSubscription();
        if (!freshProfile) return;
        const paymentStatus = freshProfile?.payment_status ||
          freshProfile?.subscription?.payment_status ||
          freshProfile?.profile?.payment_status ||
          freshProfile?.payment?.status;

        const incomingReqId = freshProfile?.subscription?.payment_request_id ||
          freshProfile?.payment_request_id ||
          freshProfile?.profile?.payment_request_id ||
          freshProfile?.payment?.payment_request_id ||
          freshProfile?.payment?.request_id;

        const activeReqId = getOrCreatePaymentRequestId();

        // If incoming response specifies a payment_request_id, match against active session request_id
        if (incomingReqId && activeReqId && incomingReqId !== activeReqId) {
          return;
        }

        if (paymentStatus === 'approved') {
          stopPendingPolling();
          restorePaymentStateFromProfile(freshProfile);
          if (typeof root.GhostLinkV3?.Home?.updateSubscriptionState === 'function') {
            root.GhostLinkV3.Home.updateSubscriptionState(freshProfile);
          }
        } else if (paymentStatus === 'rejected') {
          stopPendingPolling();
          restorePaymentStateFromProfile(freshProfile);
          if (typeof root.GhostLinkV3?.Home?.updateSubscriptionState === 'function') {
            root.GhostLinkV3.Home.updateSubscriptionState(freshProfile);
          }
        }
      } catch (_) {
        // Polling silently absorbs network hiccups
      }
    }, 4000);
    if (typeof pendingPollTimer?.unref === 'function') {
      pendingPollTimer.unref();
    }
  }

  function stopPendingPolling() {
    if (pendingPollTimer) {
      clearInterval(pendingPollTimer);
      pendingPollTimer = null;
    }
  }

  function setCheckoutView(state) {
    if (!checkoutFormView) return;
    // CSS uses this state to keep receipt screens static while the form can scroll.
    if (pageCheckout) pageCheckout.dataset.checkoutView = state;
    checkoutFormView.style.display = state === 'form' ? 'flex' : 'none';
    checkoutPendingView.style.display = state === 'pending' ? 'flex' : 'none';
    checkoutApprovedView.style.display = state === 'approved' ? 'flex' : 'none';
    checkoutRejectedView.style.display = state === 'rejected' ? 'flex' : 'none';

    if (state === 'pending') {
      startPendingPolling();
    } else {
      stopPendingPolling();
    }
  }

  function restorePaymentStateFromProfile(snapshot) {
    if (!snapshot) return;
    const paymentStatus = snapshot?.payment_status ||
      snapshot?.subscription?.payment_status ||
      snapshot?.profile?.payment_status ||
      snapshot?.payment?.status;

    const paymentAmount = snapshot?.payment?.amount ??
      snapshot?.subscription?.payment_amount ??
      snapshot?.profile?.payment_amount ??
      snapshot?.payment_amount;

    const paymentPlan = snapshot?.payment?.label ||
      snapshot?.subscription?.payment_label ||
      snapshot?.profile?.payment_label ||
      snapshot?.payment_label ||
      snapshot?.subscription?.plan?.title ||
      'Solo Ghost';

    const paymentSender = snapshot?.payment?.sender ||
      snapshot?.subscription?.payment_sender ||
      snapshot?.profile?.payment_sender ||
      snapshot?.payment_sender ||
      '';

    const paymentTime = snapshot?.payment?.timeMsk ||
      snapshot?.subscription?.payment_time_msk ||
      snapshot?.profile?.payment_time_msk ||
      snapshot?.payment_time_msk ||
      '';

    const paymentBank = snapshot?.payment?.bank ||
      snapshot?.subscription?.payment_bank ||
      snapshot?.payment_bank ||
      reqBankName?.textContent ||
      'Т-Банк';

    if (paymentStatus === 'pending_verification' || paymentStatus === 'pending') {
      if (pendingPlanEl) pendingPlanEl.textContent = paymentPlan;
      if (pendingAmountEl) pendingAmountEl.textContent = paymentAmount ? `${paymentAmount} ₽` : '150 ₽';
      if (pendingPayerEl && paymentSender) pendingPayerEl.textContent = paymentSender;
      if (pendingBankEl && paymentBank) pendingBankEl.textContent = formatBankName(paymentBank);
      if (pendingTimeEl && paymentTime) pendingTimeEl.textContent = paymentTime;
      setCheckoutView('pending');
    } else if (paymentStatus === 'approved') {
      if (approvedAmountEl) approvedAmountEl.textContent = paymentAmount ? `${paymentAmount} ₽` : '150 ₽';
      if (approvedPlanEl) approvedPlanEl.textContent = paymentPlan;
      setCheckoutView('approved');
      try {
        root.sessionStorage?.removeItem?.(PAYMENT_REQ_STORAGE_KEY);
      } catch (_) {}
    } else if (paymentStatus === 'rejected') {
      if (rejectedPlanEl) rejectedPlanEl.textContent = paymentPlan;
      if (rejectedAmountEl) rejectedAmountEl.textContent = paymentAmount ? `${paymentAmount} ₽` : '150 ₽';
      if (rejectedPayerEl && paymentSender) rejectedPayerEl.textContent = paymentSender;
      setCheckoutView('rejected');
      try {
        root.sessionStorage?.removeItem?.(PAYMENT_REQ_STORAGE_KEY);
      } catch (_) {}
    }
  }

  // Initial state is form view unless cached profile is pending
  setCheckoutView('form');
  if (profileSubscription?.getCachedProfile) {
    restorePaymentStateFromProfile(profileSubscription.getCachedProfile());
  }

  // Extend Subscription Page Logic
  if (bentoExtend && pageExtend && btnExtendBack) {
    bentoExtend.addEventListener('click', () => {
      const cached = profileSubscription?.getCachedProfile?.() || null;
      const paymentStatus = cached?.payment_status ||
        cached?.subscription?.payment_status ||
        cached?.profile?.payment_status ||
        cached?.payment?.status;
      if (paymentStatus === 'pending_verification' || paymentStatus === 'pending') {
        restorePaymentStateFromProfile(cached);
        openOverlay(pageCheckout);
        return;
      }
      if (paymentStatus === 'approved') {
        restorePaymentStateFromProfile(cached);
        openOverlay(pageCheckout);
        return;
      }
      calculateTotals();
      openOverlay(pageExtend);
    });
    
    btnExtendBack.addEventListener('click', () => {
      closeOverlay(pageExtend);
    });
  }

  // Reactive auto-refresh when profile / tariffs update
  if (typeof profileSubscription?.subscribe === 'function') {
    profileSubscription.subscribe(() => {
      calculateTotals();
    });
  }
  if (typeof profileSubscription?.onUpdate === 'function') {
    profileSubscription.onUpdate(() => {
      calculateTotals();
    });
  }

  const PAYMENT_REQ_STORAGE_KEY = 'ghostlink_payment_request_id';

  function getOrCreatePaymentRequestId() {
    if (!currentPaymentRequestId) {
      try {
        currentPaymentRequestId = root.sessionStorage?.getItem?.(PAYMENT_REQ_STORAGE_KEY) || null;
      } catch (_) {}
    }
    if (!currentPaymentRequestId) {
      currentPaymentRequestId = generateUuidV4();
      try {
        root.sessionStorage?.setItem?.(PAYMENT_REQ_STORAGE_KEY, currentPaymentRequestId);
      } catch (_) {}
    }
    return currentPaymentRequestId;
  }

  function resetPaymentRequestId() {
    currentPaymentRequestId = generateUuidV4();
    try {
      root.sessionStorage?.setItem?.(PAYMENT_REQ_STORAGE_KEY, currentPaymentRequestId);
    } catch (_) {}
    return currentPaymentRequestId;
  }

  function renderPaymentDetails(details) {
    const bankLabel = formatBankName(details.bankKey || details.bank) || paymentConfig?.banks[details.bankKey] || 'Т-Банк';
    if (pageCheckout) pageCheckout.dataset.bank = details.bankKey || details.bank || 'tbank';
    if (reqBankName) reqBankName.textContent = bankLabel;
    if (confirmationBankName) confirmationBankName.textContent = bankLabel;
    if (pendingBankEl) pendingBankEl.textContent = bankLabel;
    if (reqPhoneNum) reqPhoneNum.textContent = details.destination || details.phone;
    if (reqRecipientName) reqRecipientName.textContent = `Получатель: ${details.recipient}`;
    if (btnCopyPhone) {
      const destinationLabel = details.destinationLabel || 'Номер';
      btnCopyPhone.setAttribute('aria-label', `Скопировать: ${destinationLabel.toLowerCase()}`);
      btnCopyPhone.setAttribute('title', `Скопировать: ${destinationLabel.toLowerCase()}`);
    }
  }

async function loadPaymentSettings() {
  if (typeof fetchImpl !== 'function') return null;
  if (settingsPromise) return settingsPromise;

  settingsPromise = (async () => {
    try {
      const token = profileSubscription?.getToken?.() || '';
      const initData = String(getInitData() || '').trim();
      const headers = {
        Accept: 'application/json',
      };
      if (token) headers['X-PWA-Token'] = token;
      if (initData) headers['X-Telegram-InitData'] = initData;

      const res = await fetchImpl(`${apiBase}/api/payment/settings`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      if (!res || !res.ok) {
        throw new Error(`HTTP ${res?.status || 500}`);
      }
      const data = await res.json();
      if (data && (data.phone || data.bank || data.recipient)) {
        liveRequisitesLoaded = true;
        const bankLabel = formatBankName(data.bank);
        const phone = data.phone || '';
        const recipient = data.recipient || '';
        if (pageCheckout) pageCheckout.dataset.bank = data.bank || 'tbank';
        if (reqBankName) reqBankName.textContent = bankLabel;
        if (confirmationBankName) confirmationBankName.textContent = bankLabel;
        if (pendingBankEl) pendingBankEl.textContent = bankLabel;
        if (reqPhoneNum) reqPhoneNum.textContent = phone;
        if (reqRecipientName) reqRecipientName.textContent = `Получатель: ${recipient}`;
        return data;
      }
      throw new Error('Empty payment settings response');
    } catch (_) {
      liveRequisitesLoaded = false;
      if (reqBankName) reqBankName.textContent = '⚠️ Ошибка связи';
      if (reqPhoneNum) reqPhoneNum.textContent = 'Реквизиты временно недоступны';
      if (reqRecipientName) reqRecipientName.textContent = 'Нажмите здесь, чтобы повторить попытку';
      return null;
    } finally {
      settingsPromise = null;
    }
  })();

  return settingsPromise;
}

function updatePayerCheck() {
  const hasName = isValidPayerName(payerNameInput?.value || '');
  if (confirmationNameDot) {
    confirmationNameDot.textContent = hasName ? '✓' : '•';
    confirmationNameDot.classList.toggle('is-ready', hasName);
  }
  if (confirmationNameText) {
    confirmationNameText.textContent = hasName ? 'Имя отправителя указано' : 'Укажи имя и фамилию как в банке';
  }
  payerNameInput?.classList.toggle('is-valid', hasName);
  return hasName;
}

function setPaymentDetails(nextDetails) {
  const details = paymentConfig ? paymentConfig.set(nextDetails) : nextDetails;
  renderPaymentDetails(details);
  return details;
}

// Admin integration point: the future settings form can use this API without knowing the markup.
root.GhostLinkPayment = Object.freeze({
  getDetails: () => paymentConfig?.get() || {},
  setDetails: setPaymentDetails,
  setBank: bankKey => setPaymentDetails({ bankKey }),
  loadSettings: loadPaymentSettings,
  restorePaymentStateFromProfile,
  setCheckoutView,
  startPendingPolling,
  stopPendingPolling,
  resetDetails: () => {
    const details = paymentConfig?.reset() || {};
    renderPaymentDetails(details);
    return details;
  },
});

renderPaymentDetails(paymentConfig?.get() || {
  bankKey: 'tbank',
  phone: '+7 (000) 000-00-00',
  recipient: 'Тестовый получатель',
});
updatePayerCheck();
void loadPaymentSettings();

if (payerNameInput) {
  payerNameInput.addEventListener('input', () => {
    payerNameInput.classList.remove('error');
    updatePayerCheck();
  });
}

// Initial check for existing payment status from cached profile
if (profileSubscription?.getCachedProfile) {
  restorePaymentStateFromProfile(profileSubscription.getCachedProfile());
}

if (btnPay && pageCheckout && btnCheckoutBack) {
  btnPay.addEventListener('click', () => {
    const cached = profileSubscription?.getCachedProfile?.() || null;
    const paymentStatus = cached?.payment_status ||
      cached?.subscription?.payment_status ||
      cached?.profile?.payment_status ||
      cached?.payment?.status;
    if (paymentStatus === 'pending_verification' || paymentStatus === 'pending') {
      restorePaymentStateFromProfile(cached);
      openOverlay(pageCheckout);
      return;
    }
    if (paymentStatus === 'approved') {
      restorePaymentStateFromProfile(cached);
      openOverlay(pageCheckout);
      return;
    }

    // Generate unique canonical UUID v4 for idempotency
    resetPaymentRequestId();
    // Never reopen a stale pending screen when starting a new payment flow.
    setCheckoutView('form');
    const activeTariff = document.querySelector('input[name="tariff-period"]:checked');
    const activeDeviceType = document.querySelector('input[name="device-type"]:checked')?.value || 'solo';
    const months = activeTariff ? parseInt(activeTariff.value, 10) : 1;
    const totalDev = activeDeviceType === 'flex' ? flexDevCount : 2;
    const currentSnapshot = profileSubscription?.getSnapshot?.() || profileSubscription?.getCachedProfile?.() || GhostLinkV3.homeModule?.getSnapshot?.() || GhostLinkV3.profileSubscription?.getSnapshot?.() || GhostLinkV3.profileSubscription?.getCachedProfile?.();
    const totalAmount = getTariffPrice(totalDev, months, currentSnapshot);

    if (!isValidPrice(totalAmount)) {
      showToast('Тарифы ещё загружаются или недоступны. Подождите...');
      return;
    }

    const planName = activeDeviceType === 'flex' ? `Flex Squad ${totalDev}` : 'Solo Ghost';
    const periodText = `${months} ${months === 1 ? 'месяц' : 'месяца'} · ${totalDev} ${totalDev === 2 || totalDev === 3 || totalDev === 4 ? 'устройства' : 'устройств'}`;

    // Populate Checkout screen safely
    const targetPlanEl = document.getElementById('checkout-target-plan');
    const targetPeriodEl = document.getElementById('checkout-target-period');
    const targetDevEl = document.getElementById('checkout-target-dev');
    const targetAmountEl = document.getElementById('checkout-target-amount');
    const pendingPlanEl = document.getElementById('pending-plan-val');
    const pendingAmountEl = document.getElementById('pending-amount-val');
    const approvedPlanEl = document.getElementById('approved-plan-val');
    const approvedDevEl = document.getElementById('approved-dev-val');

    if (targetPlanEl) targetPlanEl.textContent = activeDeviceType === 'flex' ? `Flex Squad ${totalDev}` : 'Solo Ghost';
    if (targetPeriodEl) targetPeriodEl.textContent = `${months} ${months === 1 ? 'месяц' : 'месяца'}`;
    if (targetDevEl) targetDevEl.textContent = `${totalDev} ${totalDev === 2 || totalDev === 3 || totalDev === 4 ? 'устройства' : 'устройств'}`;
    if (targetAmountEl) targetAmountEl.textContent = `${totalAmount} ₽`;
    if (pendingPlanEl) pendingPlanEl.textContent = planName;
    if (pendingAmountEl) pendingAmountEl.textContent = `${totalAmount} ₽`;
    if (pendingBankEl) pendingBankEl.textContent = reqBankName?.textContent || 'Т-Банк';
    if (approvedPlanEl) approvedPlanEl.textContent = planName;
    if (approvedDevEl) approvedDevEl.textContent = `${totalDev}`;
    if (approvedAmountEl) approvedAmountEl.textContent = `${totalAmount} ₽`;
    if (rejectedPlanEl) rejectedPlanEl.textContent = planName;
    if (rejectedAmountEl) rejectedAmountEl.textContent = `${totalAmount} ₽`;

    // Each new request receives its own immutable payment-details snapshot.
    if (window.GhostLinkV3?.PaymentSettingsMock) {
      currentPaymentRequest = window.GhostLinkV3.PaymentSettingsMock.createPaymentSnapshot({
        requestId: currentPaymentRequestId,
        planId: activeDeviceType === 'flex' ? `flex-${totalDev}` : 'solo-ghost',
        amount: totalAmount,
      });
      const snapshotView = paymentConfig?.fromSnapshot(
        currentPaymentRequest.paymentDetailsSnapshot,
      );
      if (snapshotView) renderPaymentDetails(snapshotView);
    }

    openOverlay(pageCheckout);
    void loadPaymentSettings();
  });

  btnCheckoutBack.addEventListener('click', () => {
    stopPendingPolling();
    closeOverlay(pageCheckout);
  });
}

// Copy phone number or trigger reload if failed
if (btnCopyPhone) {
  btnCopyPhone.addEventListener('click', async () => {
    if (!liveRequisitesLoaded) {
      showToast('Загружаем реквизиты...');
      await loadPaymentSettings();
      return;
    }
    const phoneNum = document.getElementById('req-phone-num')?.textContent || '';
    if (!phoneNum || phoneNum.includes('недоступны')) {
      await loadPaymentSettings();
      return;
    }
    const copied = await copyText(phoneNum);
    showToast(copied ? 'Реквизиты скопированы' : 'Не удалось скопировать. Нажмите и удерживайте реквизиты.');
  });
}

if (reqRecipientName) {
  reqRecipientName.addEventListener('click', () => {
    if (!liveRequisitesLoaded) void loadPaymentSettings();
  });
}

let isSubmittingPayment = false;

// Submit payment confirmation
if (btnSubmitPayment && payerNameInput) {
  btnSubmitPayment.addEventListener('click', async () => {
    if (isSubmittingPayment) return;

    if (!liveRequisitesLoaded) {
      showToast('Реквизиты недоступны. Повторяем загрузку...');
      const loaded = await loadPaymentSettings();
      if (!loaded && !liveRequisitesLoaded) {
        showToast('Не удалось загрузить реквизиты. Проверьте сеть и повторите.');
        return;
      }
    }

    const nameVal = payerNameInput.value.trim();
    const validName = updatePayerCheck();
    if (!validName) {
      payerNameInput.classList.add('error');
      showToast(nameVal ? "Укажи имя и фамилию как в банковском переводе" : "Укажи имя отправителя перевода");
      payerNameInput.focus();
      return;
    }
    
    payerNameInput.classList.remove('error');

    // Collect active values from Extend screen
    const activeTariff = document.querySelector('input[name="tariff-period"]:checked');
    const activeDeviceType = document.querySelector('input[name="device-type"]:checked')?.value || 'solo';
    const months = activeTariff ? parseInt(activeTariff.value, 10) : 1;
    const totalDev = activeDeviceType === 'flex' ? flexDevCount : 2;
    const currentSnapshot = profileSubscription?.getSnapshot?.() || profileSubscription?.getCachedProfile?.() || GhostLinkV3.homeModule?.getSnapshot?.() || GhostLinkV3.profileSubscription?.getSnapshot?.() || GhostLinkV3.profileSubscription?.getCachedProfile?.();
    const totalAmount = getTariffPrice(totalDev, months, currentSnapshot);

    if (!isValidPrice(totalAmount)) {
      showToast('Ошибка тарифов: стоимость не определена. Повторите попытку.');
      return;
    }
    const planName = activeDeviceType === 'flex' ? `Flex Squad ${totalDev}` : 'Solo Ghost';
    
    // Prevent double submission
    isSubmittingPayment = true;
    btnSubmitPayment.disabled = true;
    btnSubmitPayment.textContent = 'Заявка отправляется...';

    const reqId = getOrCreatePaymentRequestId();
    const payload = {
      request_id: reqId,
      payment_request_id: reqId,
      amount: totalAmount,
      sender_name: nameVal,
      payment_label: planName,
      target_device_limit: totalDev,
      period_months: months,
    };

    try {
      const token = profileSubscription?.getToken?.() || '';
      const initData = String(getInitData() || '').trim();
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-ID': reqId,
      };
      if (token) headers['X-PWA-Token'] = token;
      if (initData) headers['X-Telegram-InitData'] = initData;

      if (typeof fetchImpl !== 'function') {
        throw new Error('Сетевой интерфейс недоступен');
      }

      const response = await fetchImpl(`${apiBase}/api/payment/report`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await response.json();
      } catch (_) {
        // non-json response
      }

      if (response.ok) {
        if (pendingPayerEl) pendingPayerEl.textContent = nameVal;
        if (rejectedPayerEl) rejectedPayerEl.textContent = nameVal;
        if (pendingPlanEl) pendingPlanEl.textContent = planName;
        if (pendingAmountEl) pendingAmountEl.textContent = `${totalAmount} ₽`;
        if (pendingBankEl) pendingBankEl.textContent = reqBankName?.textContent || 'Т-Банк';
        if (pendingTimeEl) {
          pendingTimeEl.textContent = new Intl.DateTimeFormat('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date());
        }
        setCheckoutView('pending');
        showToast('Заявка на оплату отправлена');
      } else {
        let errorMsg = 'Не удалось отправить заявку. Попробуйте ещё раз.';
        if (response.status === 400) {
          errorMsg = data?.detail || 'Некорректные данные платежа. Проверьте сумму и имя.';
        } else if (response.status === 401) {
          errorMsg = data?.detail || 'Сессия истекла. Откройте Mini App через Telegram ещё раз.';
        } else if (response.status >= 500) {
          errorMsg = 'Сервер временно недоступен. Попробуйте позже.';
        } else if (data?.detail) {
          errorMsg = data.detail;
        }
        showToast(errorMsg);
      }
    } catch (err) {
      showToast('Не удалось связаться с GhostLink. Проверьте подключение.');
    } finally {
      isSubmittingPayment = false;
      btnSubmitPayment.disabled = false;
      btnSubmitPayment.textContent = 'Я оплатил';
    }
  });

  payerNameInput.addEventListener('input', () => {
    payerNameInput.classList.remove('error');
  });
}

// Retry payment button
if (btnRetryPayment) {
  btnRetryPayment.addEventListener('click', () => {
    if (payerNameInput) {
      payerNameInput.value = '';
      payerNameInput.classList.remove('error');
    }
    updatePayerCheck();
    setCheckoutView('form');
  });
}

if (btnPendingHome) {
  btnPendingHome.addEventListener('click', () => {
    stopPendingPolling();
    returnToHome();
  });
}

if (btnApprovedHome) {
  btnApprovedHome.addEventListener('click', () => {
    stopPendingPolling();
    returnToHome();
  });
}

// Pricing Calculator Logic
const tariffRadios = document.querySelectorAll('input[name="tariff-period"]');
const deviceRadios = document.querySelectorAll('input[name="device-type"]');
const flexCountEl = document.getElementById('flex-dev-count');
const btnDevMinus = document.getElementById('btn-dev-minus');
const btnDevPlus = document.getElementById('btn-dev-plus');

let flexDevCount = 3;

function calculateTotals() {
  const activeTariff = document.querySelector('input[name="tariff-period"]:checked');
  const activeDeviceType = document.querySelector('input[name="device-type"]:checked')?.value || 'solo';
  
  let totalDevices = 2; // Solo Ghost
  if (activeDeviceType === 'flex') {
    totalDevices = flexDevCount;
  }

  const currentSnapshot = profileSubscription?.getSnapshot?.() || profileSubscription?.getCachedProfile?.() || GhostLinkV3.homeModule?.getSnapshot?.() || GhostLinkV3.profileSubscription?.getSnapshot?.() || GhostLinkV3.profileSubscription?.getCachedProfile?.();

  // Update prices shown on the month cards dynamically based on totalDevices
  const price1 = getTariffPrice(totalDevices, 1, currentSnapshot);
  const price2 = getTariffPrice(totalDevices, 2, currentSnapshot);
  const price3 = getTariffPrice(totalDevices, 3, currentSnapshot);

  const pCard1 = document.getElementById('price-card-1');
  const pCard2 = document.getElementById('price-card-2');
  const pCard3 = document.getElementById('price-card-3');
  const subCard1 = document.getElementById('subprice-card-1');
  const subCard2 = document.getElementById('subprice-card-2');
  const subCard3 = document.getElementById('subprice-card-3');

  if (isValidPrice(price1)) {
    if (pCard1) pCard1.textContent = `${price1} ₽`;
    if (subCard1) subCard1.textContent = `${price1} ₽ / мес`;
  } else {
    if (pCard1) pCard1.textContent = '— ₽';
    if (subCard1) subCard1.textContent = 'Загрузка…';
  }

  if (isValidPrice(price2)) {
    if (pCard2) pCard2.textContent = `${price2} ₽`;
    if (subCard2) subCard2.textContent = `${Math.round(price2 / 2)} ₽ / мес`;
  } else {
    if (pCard2) pCard2.textContent = '— ₽';
    if (subCard2) subCard2.textContent = 'Загрузка…';
  }

  if (isValidPrice(price3)) {
    if (pCard3) pCard3.textContent = `${price3} ₽`;
    if (subCard3) subCard3.textContent = `${Math.round(price3 / 3)} ₽ / мес`;
  } else {
    if (pCard3) pCard3.textContent = '— ₽';
    if (subCard3) subCard3.textContent = 'Загрузка…';
  }
  
  const months = parseInt(activeTariff?.value || '1', 10);
  const totalPrice = getTariffPrice(totalDevices, months, currentSnapshot);
  
  // Dynamic Description Above Swiper
  const devicesDescEl = document.getElementById('devices-desc');
  if (devicesDescEl) {
    if (activeDeviceType === 'flex') {
      devicesDescEl.textContent = 'Гибкий тариф под нужное количество устройств';
    } else {
      devicesDescEl.textContent = 'Базовый тариф — всего 2 устройства';
    }
  }

  // Dynamic Highlight for Device Icons Pill Widget
  const iconPhone = document.getElementById('icon-phone');
  const iconLaptop = document.getElementById('icon-laptop');
  const iconTv = document.getElementById('icon-tv');
  if (iconPhone && iconLaptop && iconTv) {
    if (totalDevices === 2) {
      iconPhone.classList.add('active');
      iconLaptop.classList.add('active');
      iconTv.classList.remove('active');
    } else {
      iconPhone.classList.add('active');
      iconLaptop.classList.add('active');
      iconTv.classList.add('active');
    }
  }
  
  // Summary Update
  const monthText = months === 1 ? '1 месяц' : `${months} месяца`;
  const devText = `${totalDevices} ${totalDevices === 2 || totalDevices === 3 || totalDevices === 4 ? 'устройства' : 'устройств'}`;
  
  const summaryDetailsEl = document.getElementById('summary-details');
  if (summaryDetailsEl) {
    summaryDetailsEl.textContent = `${monthText} · ${devText}`;
  }
  
  const summaryDayCostEl = document.getElementById('summary-day-cost');
  if (summaryDayCostEl) {
    if (isValidPrice(totalPrice)) {
      const days = months * 30;
      const costPerDay = (totalPrice / days).toFixed(2).replace('.', ',');
      summaryDayCostEl.textContent = `${costPerDay} ₽ / день`;
    } else {
      summaryDayCostEl.textContent = '— ₽ / день';
    }
  }
  
  // Update Pay Button
  const payTotalEl = document.getElementById('pay-total');
  const payOldEl = document.getElementById('pay-old');
  const payDiscountEl = document.getElementById('pay-discount');

  if (isValidPrice(totalPrice)) {
    if (btnPay) {
      btnPay.disabled = false;
      btnPay.classList.remove('disabled');
      btnPay.setAttribute('aria-disabled', 'false');
    }
    if (payTotalEl) payTotalEl.textContent = `${totalPrice} ₽`;
    
    // Discount badge / old price calculation
    const baseFullPrice = isValidPrice(price1) ? price1 * months : null;
    if (baseFullPrice && baseFullPrice > totalPrice) {
      const oldPrice = baseFullPrice;
      const discountPct = Math.round((1 - totalPrice / baseFullPrice) * 100);
      if (payOldEl) {
        payOldEl.textContent = `${oldPrice} ₽`;
        payOldEl.style.display = 'inline';
      }
      if (payDiscountEl) {
        payDiscountEl.textContent = `-${discountPct}%`;
        payDiscountEl.style.display = 'inline-block';
      }
    } else {
      if (payOldEl) payOldEl.style.display = 'none';
      if (payDiscountEl) payDiscountEl.style.display = 'none';
    }
  } else {
    if (btnPay) {
      btnPay.disabled = true;
      btnPay.classList.add('disabled');
      btnPay.setAttribute('aria-disabled', 'true');
    }
    if (payTotalEl) payTotalEl.textContent = 'Загрузка тарифов…';
    if (payOldEl) payOldEl.style.display = 'none';
    if (payDiscountEl) payDiscountEl.style.display = 'none';
  }
}

// Event Listeners for Calculator
tariffRadios.forEach(radio => radio.addEventListener('change', calculateTotals));
deviceRadios.forEach(radio => radio.addEventListener('change', calculateTotals));

if (btnDevMinus && btnDevPlus) {
  btnDevMinus.addEventListener('click', (e) => {
    e.preventDefault();
    if (flexDevCount > 3) {
      flexDevCount--;
      flexCountEl.textContent = flexDevCount;
      document.querySelector('input[value="flex"]').checked = true; // Auto select Flex Squad
      calculateTotals();
    }
  });
  
  btnDevPlus.addEventListener('click', (e) => {
    e.preventDefault();
    if (flexDevCount < 5) {
      flexDevCount++;
      flexCountEl.textContent = flexDevCount;
      document.querySelector('input[value="flex"]').checked = true; // Auto select Flex Squad
      calculateTotals();
    }
  });
}

// Initial calculation
calculateTotals();

// Swipe support for Device Type Swiper Cards
const deviceSwiper = document.querySelector('.device-swiper');
const deviceSlides = document.querySelectorAll('.device-swiper .bento-card');
const paginationDots = document.querySelectorAll('.swiper-dot');

if (deviceSwiper && deviceSlides.length > 0) {
  // 1. Listen to scroll event to update active dot & radio
  let scrollTimeout;
  deviceSwiper.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const scrollLeft = deviceSwiper.scrollLeft;
      const slideWidth = deviceSlides[0].offsetWidth;
      const activeIdx = Math.round(scrollLeft / slideWidth);

      // Update dots
      paginationDots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === activeIdx);
      });

      // Update underlying radio button
      const targetRadio = deviceSlides[activeIdx]?.querySelector('input[name="device-type"]');
      if (targetRadio && !targetRadio.checked) {
        targetRadio.checked = true;
        calculateTotals();
      }
    }, 50);
  });

  // 2. Click listener on card directly
  deviceSlides.forEach((slide, idx) => {
    slide.addEventListener('click', (e) => {
      // Avoid recursive change event loops if radio itself was clicked
      if (e.target.tagName !== 'INPUT') {
        const radio = slide.querySelector('input[name="device-type"]');
        if (radio && !radio.checked) {
          radio.checked = true;
          calculateTotals();
        }
      }
      
      // Scroll into view centered
      const targetScroll = slide.offsetLeft - (deviceSwiper.clientWidth - slide.clientWidth) / 2;
      deviceSwiper.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    });
  });

  // 3. Click listener on pagination dots
  paginationDots.forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      const slide = deviceSlides[idx];
      if (slide) {
        const targetScroll = slide.offsetLeft - (deviceSwiper.clientWidth - slide.clientWidth) / 2;
        deviceSwiper.scrollTo({
          left: Math.max(0, targetScroll),
          behavior: 'smooth'
        });
      }
    });
  });
}

};

const exported = {
  initSubscriptionModule: GhostLinkV3.initSubscriptionModule,
  restorePaymentStateFromProfile: (snapshot) => root.GhostLinkPayment?.restorePaymentStateFromProfile?.(snapshot),
  setCheckoutView: (state) => root.GhostLinkPayment?.setCheckoutView?.(state),
  startPendingPolling: () => root.GhostLinkPayment?.startPendingPolling?.(),
  stopPendingPolling: () => root.GhostLinkPayment?.stopPendingPolling?.(),
  getTariffPrice,
  isValidPrice,
  generateUuidV4,
  formatBankName,
  isValidPayerName,
  BANK_NAMES,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exported;
}
})();
