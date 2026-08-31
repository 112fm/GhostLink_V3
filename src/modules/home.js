(function initHomeScope(root) {
  const GhostLinkV3 = root.GhostLinkV3 = root.GhostLinkV3 || {};

  function pluralize(value, forms) {
    const remainder = Math.abs(value) % 100;
    const lastDigit = remainder % 10;

    if (remainder > 10 && remainder < 20) return forms[2];
    if (lastDigit === 1) return forms[0];
    if (lastDigit >= 2 && lastDigit <= 4) return forms[1];
    return forms[2];
  }

  function toNonNegativeInteger(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
  }

  function getLoadingSubscriptionPresentation() {
    return {
      state: 'loading', planTitle: '', emoji: '', remainingDays: null,
      daysValue: '', daysLabel: '', deviceLabel: '', progress: 100, actionLabel: 'Продлить подписку',
      isDemo: false, progressKnown: true,
    };
  }

  // This presentation is the stable UI contract for the future profile endpoint.
  function getSubscriptionPresentation(snapshot) {
    const error = snapshot?.error;
    if (error?.status === 401) {
      return {
        state: 'auth', planTitle: 'ТРЕБУЕТСЯ ВХОД', emoji: '🔐', remainingDays: null,
        daysLabel: '', deviceLabel: 'Откройте Mini App через Telegram ещё раз', progress: 0,
        actionLabel: 'Повторить вход', isDemo: false,
      };
    }
    if (error?.status === 403) {
      return {
        state: 'denied', planTitle: 'ДОСТУП ЗАКРЫТ', emoji: '🔒', remainingDays: null,
        daysLabel: '', deviceLabel: 'Доступ к профилю ограничен', progress: 0,
        actionLabel: 'Понятно', isDemo: false,
      };
    }
    if (error?.type === 'timeout') {
      return {
        state: 'unavailable', planTitle: 'ЗАГРУЗКА НЕ УДАЛАСЬ', emoji: '…', remainingDays: null,
        daysLabel: '', deviceLabel: 'Загрузка заняла слишком долго. Попробуйте ещё раз.', progress: 0,
        actionLabel: 'Повторить', isDemo: false,
      };
    }
    if (error?.type === 'network') {
      return {
        state: 'unavailable', planTitle: 'НЕТ СОЕДИНЕНИЯ', emoji: '…', remainingDays: null,
        daysLabel: '', deviceLabel: 'Не удалось связаться с GhostLink. Проверьте подключение', progress: 0,
        actionLabel: 'Повторить', isDemo: false,
      };
    }
    if (error) {
      return {
        state: 'unavailable',
        planTitle: error.status >= 500 ? 'СЕРВЕР НЕДОСТУПЕН' : (error.message || 'ОШИБКА СВЯЗИ'),
        emoji: '⚠️',
        remainingDays: null,
        daysLabel: '',
        deviceLabel: 'Не удалось загрузить данные. Попробуйте обновить',
        progress: 0,
        actionLabel: 'Повторить',
        isDemo: false,
      };
    }

    const subscription = snapshot?.subscription ?? snapshot;
    if (!subscription) {
      return {
        state: 'unavailable', planTitle: 'ПОДПИСКА', emoji: '…', remainingDays: null,
        daysLabel: '', deviceLabel: 'Данные временно недоступны', progress: 0,
        actionLabel: 'Выбрать тариф', isDemo: false,
      };
    }

    const rawTotalDays = Number(subscription.totalDays);
    const hasTotalDays = Number.isFinite(rawTotalDays) && rawTotalDays > 0;
    const totalDays = hasTotalDays ? Math.floor(rawTotalDays) : 0;
    const rawRemainingDays = subscription.remainingDays ?? subscription.daysLeft;
    const remainingDays = rawRemainingDays === null || rawRemainingDays === undefined
      ? null
      : toNonNegativeInteger(rawRemainingDays, 0);
    const deviceLimit = toNonNegativeInteger(subscription.deviceLimit ?? subscription.deviceCount, 0);
    const usedDevices = toNonNegativeInteger(subscription.usedDevices, 0);
    const isTimeless = Boolean(subscription.isTimeless);
    const isVip = isTimeless || subscription.state === 'vip' || (subscription.plan?.id === 'vip');
    const isPending = subscription.state === 'pending'
      || subscription.payment_status === 'pending_verification'
      || subscription.payment_status === 'pending'
      || snapshot?.payment_status === 'pending_verification'
      || snapshot?.payment_status === 'pending';
    const isAccessClosed = subscription.state === 'none' || subscription.state === 'denied';
    const isNew = subscription.state === 'new';
    const isActive = isTimeless
      ? Boolean(subscription.active)
      : Boolean(subscription.active) && remainingDays !== null && remainingDays > 0;
    const hasProgressBasis = hasTotalDays
      && remainingDays !== null
      && (Boolean(subscription.startedAt) || snapshot?.isMock === true);
    const progress = isTimeless || (isVip && isActive) ? 100 : (hasProgressBasis ? Math.min(100, Math.round((remainingDays / totalDays) * 100)) : null);

    let state = 'active';
    if (isPending) state = 'pending';
    else if (isAccessClosed) state = 'denied';
    else if (isNew) state = 'new';
    else if (!isActive) state = 'expired';
    else if (isVip) state = 'vip';
    else if (progress !== null && progress < 20) state = 'critical';
    else if (progress !== null && progress <= 50) state = 'warning';

    const plan = subscription.plan || {};
    if (state === 'pending') {
      return {
        state, planTitle: 'ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ', emoji: '⏳', remainingDays: null,
        daysLabel: '', deviceLabel: 'Заявка на подписку уже отправлена', progress: 0,
        actionLabel: 'Проверить статус', isDemo: Boolean(snapshot?.isMock),
      };
    }
    if (state === 'denied') {
      return {
        state, planTitle: 'ДОСТУП ЗАКРЫТ', emoji: '🔒', remainingDays: null,
        daysLabel: '', deviceLabel: 'Для доступа требуется приглашение', progress: 0,
        actionLabel: 'Понятно', isDemo: Boolean(snapshot?.isMock),
      };
    }

    const isNewUser = state === 'new';
    const isExpired = state === 'expired';
    const isDemo = snapshot?.isMock === true;
    const planIdentity = `${plan.id || ''} ${plan.title || ''}`.trim().toLowerCase();
    const isGift = planIdentity === 'gift'
      || planIdentity.includes(' gift')
      || planIdentity.includes('подар');
    const title = isGift
      ? 'ПОДАРОЧНЫЙ'
      : (plan.title || (isNewUser ? 'ВЫБЕРИТЕ ТАРИФ' : (isExpired ? 'SOLO' : 'ТАРИФ НЕ УКАЗАН')));
    const emoji = isGift ? '🎁' : (plan.emoji || (isExpired ? '👻' : ''));
    const daysValue = isTimeless
      ? 'Без срока'
      : (isExpired || remainingDays === 0
        ? '0'
        : (isNewUser || remainingDays === null ? '—' : String(remainingDays)));
    const daysLabel = isTimeless || isNewUser
      ? ''
      : (isExpired || remainingDays === 0
        ? 'ДНЕЙ'
        : (remainingDays === null ? '' : pluralize(remainingDays, ['ДЕНЬ', 'ДНЯ', 'ДНЕЙ'])));

    return {
      state,
      planTitle: isDemo ? `ДЕМО · ${title}` : title,
      emoji,
      remainingDays: isExpired ? 0 : remainingDays,
      daysValue,
      daysLabel,
      deviceLabel: deviceLimit > 0
        ? `${isDemo ? 'Демо: ' : ''}${usedDevices} ${pluralize(usedDevices, ['устройство', 'устройства', 'устройств'])} · лимит ${deviceLimit}`
        : (isNewUser ? 'Устройства появятся после выбора тарифа' : `${usedDevices} ${pluralize(usedDevices, ['устройство', 'устройства', 'устройств'])} · лимит не указан`),
      progress: isExpired ? 0 : progress,
      actionLabel: isNewUser ? 'Выбрать тариф' : 'Продлить подписку',
      isDemo,
      progressKnown: isExpired ? true : progress !== null,
    };
  }

  function setElementText(documentRef, id, text) {
    const element = documentRef.getElementById(id);
    if (element) element.textContent = text;
  }

  function renderSubscriptionStatus(snapshot, documentRef = root.document, { loading = false } = {}) {
    if (!documentRef) return;

    const island = documentRef.getElementById('subscriptionStatus');
    if (!island) return;

    const presentation = loading ? getLoadingSubscriptionPresentation() : getSubscriptionPresentation(snapshot);
    const isUnavailable = presentation.state === 'unavailable';
    documentRef.querySelector('.app-shell')?.classList.toggle('is-access-denied', presentation.state === 'denied');
    island.dataset.subscriptionState = presentation.state;
    island.setAttribute('aria-busy', String(loading));
    island.classList.toggle('is-subscription-loading', loading);
    island.classList.toggle('is-subscription-demo', presentation.isDemo);
    island.classList.toggle('is-subscription-warning', presentation.state === 'warning');
    island.classList.toggle('is-subscription-critical', ['critical', 'expired'].includes(presentation.state));
    island.classList.toggle('is-subscription-unavailable', presentation.state === 'unavailable');
    island.classList.toggle('is-subscription-progress-unknown', presentation.progressKnown === false);
    island.style.setProperty('--subscription-progress', `${presentation.progress ?? 0}%`);

    setElementText(documentRef, 'subscriptionEmoji', presentation.emoji);
    setElementText(documentRef, 'subscriptionPlanName', presentation.planTitle);
    setElementText(documentRef, 'subscriptionDays', presentation.daysValue ?? (isUnavailable || presentation.state === 'new' || presentation.remainingDays === null ? '--' : String(presentation.remainingDays)));
    setElementText(documentRef, 'subscriptionDaysLabel', presentation.daysLabel);
    setElementText(documentRef, 'subscriptionDeviceCount', presentation.deviceLabel);
    setElementText(documentRef, 'homeSubscriptionActionText', presentation.actionLabel);
  }

  function updateAdminSettingsVisibility(snapshot, documentRef = root.document) {
    if (!documentRef) return;
    const btnSettingsAdmin = documentRef.getElementById('btnSettingsAdmin');
    if (!btnSettingsAdmin) return;
    const isAdmin = Boolean(
      snapshot?.user?.is_admin ||
      snapshot?.profile?.isAdmin ||
      snapshot?.profile?.is_admin
    );
    btnSettingsAdmin.style.display = isAdmin ? 'flex' : 'none';
  }

  function initHomeModule(dependencies = {}) {
    const documentRef = root.document;
    if (!documentRef) return null;

    const profileSubscription = dependencies.profileSubscription || GhostLinkV3.createMockProfileSubscription?.();
    let requestSequence = 0;
    let currentLoad = null;
    const minimumLoadingMs = 150;

    function renderLoading() {
      renderSubscriptionStatus(null, documentRef, { loading: true });
    }

    function loadProfileSubscription() {
      if (!profileSubscription || currentLoad) return currentLoad;
      const currentRequest = ++requestSequence;
      renderLoading();
      const waitForLoadingAnimation = new Promise((resolve) => root.setTimeout(resolve, minimumLoadingMs));
      currentLoad = Promise.all([profileSubscription.fetchProfileSubscription(), waitForLoadingAnimation])
        .then(([snapshot]) => {
          if (currentRequest === requestSequence) {
            renderSubscriptionStatus(snapshot, documentRef);
            updateAdminSettingsVisibility(snapshot, documentRef);
            root.GhostLinkPayment?.restorePaymentStateFromProfile?.(snapshot);
          }
          return snapshot;
        })
        .catch((error) => {
          if (currentRequest === requestSequence) {
            renderSubscriptionStatus({ error }, documentRef);
            updateAdminSettingsVisibility(null, documentRef);
          }
          return null;
        })
        .finally(() => {
          currentLoad = null;
        });
      return currentLoad;
    }

    const bottomNav = documentRef.querySelector('.bottom-nav');
    const navItems = documentRef.querySelectorAll('.nav-item');
    const tabContents = documentRef.querySelectorAll('.tab-content');

    navItems.forEach((item, index) => {
      item.addEventListener('click', () => {
        navItems.forEach((nav) => nav.classList.remove('active'));
        item.classList.add('active');
        if (bottomNav) bottomNav.style.setProperty('--active-index', index);

        tabContents.forEach((tab) => tab.classList.remove('active'));
        const targetId = item.getAttribute('data-target');
        documentRef.getElementById(targetId)?.classList.add('active');

        if (targetId === 'tab-home') loadProfileSubscription();
        if (targetId === 'tab-support') {
          root.document.body.classList.add('hide-header');
          const history = documentRef.getElementById('supportChatHistory');
          if (history) history.scrollTop = history.scrollHeight;
        } else {
          root.document.body.classList.remove('hide-header');
        }
      });
    });

    loadProfileSubscription();
    return { loadProfileSubscription };
  }

  const exported = {
    getLoadingSubscriptionPresentation,
    getSubscriptionPresentation,
    renderSubscriptionStatus,
    updateAdminSettingsVisibility,
    initHomeModule,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  Object.assign(GhostLinkV3, exported);
})(typeof window !== 'undefined' ? window : globalThis);
