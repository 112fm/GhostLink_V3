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

  // This presentation is the stable UI contract for the future profile endpoint.
  function getSubscriptionPresentation(snapshot) {
    const error = snapshot?.error;
    if (error?.status === 401) {
      return {
        state: 'auth', planTitle: 'ТРЕБУЕТСЯ ВХОД', emoji: '🔐', remainingDays: null,
        daysLabel: '', deviceLabel: 'Откройте Mini App через Telegram ещё раз', progress: 0,
        actionLabel: 'Повторить вход',
      };
    }
    if (error?.status === 403) {
      return {
        state: 'denied', planTitle: 'ДОСТУП ЗАКРЫТ', emoji: '🔒', remainingDays: null,
        daysLabel: '', deviceLabel: 'Доступ к профилю ограничен', progress: 0,
        actionLabel: 'Понятно',
      };
    }

    const subscription = snapshot?.subscription ?? snapshot;
    if (!subscription) {
      return {
        state: 'unavailable', planTitle: 'ПОДПИСКА', emoji: '…', remainingDays: null,
        daysLabel: '', deviceLabel: 'Данные временно недоступны', progress: 0,
        actionLabel: 'Выбрать тариф',
      };
    }

    const totalDays = toNonNegativeInteger(subscription.totalDays, 0);
    const remainingDays = toNonNegativeInteger(subscription.remainingDays ?? subscription.daysLeft, 0);
    const deviceLimit = toNonNegativeInteger(subscription.deviceLimit ?? subscription.deviceCount, 0);
    const usedDevices = Math.min(toNonNegativeInteger(subscription.usedDevices, 0), deviceLimit);
    const isPending = subscription.state === 'pending';
    const isAccessClosed = subscription.state === 'none' || subscription.state === 'denied';
    const isNew = subscription.state === 'new';
    const isActive = Boolean(subscription.active) && remainingDays > 0;
    const progress = totalDays > 0 ? Math.min(100, Math.round((remainingDays / totalDays) * 100)) : 0;

    let state = 'active';
    if (isPending) state = 'pending';
    else if (isAccessClosed) state = 'denied';
    else if (isNew) state = 'new';
    else if (!isActive) state = 'expired';
    else if (progress <= 15) state = 'critical';
    else if (progress <= 35) state = 'warning';

    const plan = subscription.plan || {};
    if (state === 'pending') {
      return {
        state, planTitle: 'ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ', emoji: '⏳', remainingDays: null,
        daysLabel: '', deviceLabel: 'Заявка на подписку уже отправлена', progress: 0,
        actionLabel: 'Проверить статус',
      };
    }
    if (state === 'denied') {
      return {
        state, planTitle: 'ДОСТУП ЗАКРЫТ', emoji: '🔒', remainingDays: null,
        daysLabel: '', deviceLabel: 'Для доступа требуется приглашение', progress: 0,
        actionLabel: 'Понятно',
      };
    }

    const requiresTariff = state === 'new' || state === 'expired';
    return {
      state,
      planTitle: plan.title || (requiresTariff ? 'ВЫБЕРИТЕ ТАРИФ' : 'GHOSTLINK'),
      emoji: plan.emoji || (requiresTariff ? '👻' : '👻'),
      remainingDays,
      daysLabel: requiresTariff ? '' : pluralize(remainingDays, ['ДЕНЬ', 'ДНЯ', 'ДНЕЙ']),
      deviceLabel: deviceLimit > 0
        ? `${usedDevices} из ${deviceLimit} ${pluralize(deviceLimit, ['устройства', 'устройств', 'устройств'])}`
        : 'Устройства появятся после выбора тарифа',
      progress,
      actionLabel: requiresTariff ? 'Выбрать тариф' : 'Продлить подписку',
    };
  }

  function setElementText(documentRef, id, text) {
    const element = documentRef.getElementById(id);
    if (element) element.textContent = text;
  }

  function renderSubscriptionStatus(snapshot, documentRef = root.document) {
    if (!documentRef) return;

    const island = documentRef.getElementById('subscriptionStatus');
    if (!island) return;

    const presentation = getSubscriptionPresentation(snapshot);
    const isUnavailable = presentation.state === 'unavailable';
    island.dataset.subscriptionState = presentation.state;
    island.classList.toggle('is-subscription-warning', presentation.state === 'warning');
    island.classList.toggle('is-subscription-critical', ['critical', 'expired'].includes(presentation.state));
    island.classList.toggle('is-subscription-unavailable', presentation.state === 'unavailable');
    island.style.setProperty('--subscription-progress', `${presentation.progress}%`);

    setElementText(documentRef, 'subscriptionEmoji', presentation.emoji);
    setElementText(documentRef, 'subscriptionPlanName', presentation.planTitle);
    setElementText(documentRef, 'subscriptionDays', isUnavailable || presentation.state === 'new' ? '--' : String(presentation.remainingDays));
    setElementText(documentRef, 'subscriptionDaysLabel', presentation.daysLabel);
    setElementText(documentRef, 'subscriptionDeviceCount', presentation.deviceLabel);
    setElementText(documentRef, 'homeSubscriptionActionText', presentation.actionLabel);
  }

  function renderProfileStatus(snapshot, documentRef = root.document) {
    const profileName = documentRef?.getElementById('homeProfileName');
    if (!profileName) return;
    if (snapshot?.error?.status === 401) {
      profileName.textContent = 'Требуется повторный вход';
      return;
    }
    if (snapshot?.error?.status === 403) {
      profileName.textContent = 'Доступ к профилю закрыт';
      return;
    }
    profileName.textContent = snapshot?.profile?.displayName
      ? `Привет, ${snapshot.profile.displayName}`
      : 'Профиль временно недоступен';
  }

  function initHomeModule(dependencies = {}) {
    const documentRef = root.document;
    if (!documentRef) return null;

    const profileSubscription = dependencies.profileSubscription || GhostLinkV3.createMockProfileSubscription?.();
    let requestSequence = 0;
    let currentLoad = null;

    function renderLoading() {
      renderProfileStatus(null, documentRef);
      renderSubscriptionStatus(null, documentRef);
    }

    function loadProfileSubscription() {
      if (!profileSubscription || currentLoad) return currentLoad;
      const currentRequest = ++requestSequence;
      renderLoading();
      currentLoad = profileSubscription.fetchProfileSubscription()
        .then((snapshot) => {
          if (currentRequest === requestSequence) {
            renderProfileStatus(snapshot, documentRef);
            renderSubscriptionStatus(snapshot, documentRef);
          }
          return snapshot;
        })
        .catch((error) => {
          if (currentRequest === requestSequence) {
            renderProfileStatus({ error }, documentRef);
            renderSubscriptionStatus({ error }, documentRef);
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

  const exported = { getSubscriptionPresentation, renderSubscriptionStatus, initHomeModule };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  Object.assign(GhostLinkV3, exported);
})(typeof window !== 'undefined' ? window : globalThis);
