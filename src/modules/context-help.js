(function initContextHelpScope(root) {
  const HELP_CONTENT = Object.freeze({
    home: {
      title: "Главная",
      steps: [
        { scope: "tab", selector: "#subscriptionStatus", title: "Статус подписки", description: "Здесь видно ваш тариф, оставшиеся дни и состояние подписки." },
        { scope: "tab", selector: ".bento-extend", title: "Продлить подписку", description: "Выберите период и количество устройств, затем перейдите к оплате." },
        { scope: "tab", selector: ".bento-setup", title: "Настроить ключи", description: "Откройте мастер подключения и добавьте ключ на нужное устройство." }
      ]
    },
    referral: {
      title: "Приглашения",
      steps: [
        { scope: "tab", selector: ".referral-mode-tabs", title: "Выберите режим приглашения", description: "Обычный режим ведёт друга в закрытый клуб. Мост 2.0 позволяет пригласить человека без доступа к сервису: ему выдаётся ключ, а после входа в бота ключ закрепляется за ним." },
        { scope: "tab", selector: "#referral-link-section", title: "Ссылка и QR-код", description: "В выбранном режиме создайте ссылку или QR-код и передайте их другу. В режиме Мост сначала создаётся временный ключ, затем приглашение в клуб." },
        { scope: "tab", selector: "#refChainContainer", title: "Бонусные дни", description: "За каждого приглашённого друга, который оплатит подписку, начисляется +14 дней. Бонусы суммируются, лимита на приглашения нет." }
      ]
    },
    settings: {
      title: "Настройки",
      steps: [
        { scope: "tab", selector: "#btnSettingsDevices", title: "Устройства", description: "Откройте список ключей и управляйте подключёнными устройствами." },
        { scope: "tab", selector: "#btnSettingsNotifications", title: "Уведомления", description: "Здесь будут настройки уведомлений аккаунта." },
        { scope: "tab", selector: "#btnSettingsPrivacy", title: "Конфиденциальность", description: "Откройте информацию о приватности и обработке данных." }
      ]
    },
    extend: {
      title: "Продление подписки",
      steps: [
        { scope: "overlay", selector: ".tariff-scroll-container", title: "Период подписки", description: "Выберите срок продления: итоговая цена пересчитается автоматически." },
        { scope: "overlay", selector: "#device-swiper", title: "Тариф и количество устройств", description: "Выберите тариф и укажите, сколько устройств должно поддерживать продление." },
        { scope: "overlay", selector: "#btn-pay", title: "Перейти к оплате", description: "Проверьте итоговую сумму и откройте реквизиты для перевода." }
      ]
    },
    checkout: {
      title: "Оплата",
      steps: [
        { scope: "overlay", selector: "#checkout-form-view .checkout-order", title: "Сумма и тариф", description: "Переведите ровно эту сумму за выбранный тариф." },
        { scope: "overlay", selector: "#checkout-form-view .checkout-requisites", title: "Реквизиты", description: "Проверьте банк, номер и получателя перед переводом." },
        { scope: "overlay", selector: "#payer-name-input", title: "Имя отправителя", description: "Введите имя и первую букву фамилии так, как они указаны в банке." },
        { scope: "overlay", selector: "#btn-submit-payment", title: "Я оплатил", description: "Нажимайте после перевода. Заявка уйдёт оператору на проверку." }
      ]
    },
    "payment-pending": {
      title: "Перевод на проверке",
      steps: [
        { scope: "overlay", selector: "#checkout-pending-view .paper-receipt", title: "Заявка создана", description: "Повторно отправлять деньги не нужно: перевод проверяет оператор." },
        { scope: "overlay", selector: "#btn-pending-home", title: "Вернуться на главную", description: "Закройте чек и продолжайте пользоваться Mini App." }
      ]
    },
    "payment-approved": {
      title: "Подписка активирована",
      steps: [
        { scope: "overlay", selector: "#checkout-approved-view .paper-receipt", title: "Подтверждение оплаты", description: "Оплата подтверждена, а срок подписки обновлён." },
        { scope: "overlay", selector: "#btn-approved-home", title: "Вернуться на главную", description: "На главной появится актуальный срок подписки." }
      ]
    },
    "payment-rejected": {
      title: "Платёж не подтверждён",
      steps: [
        { scope: "overlay", selector: "#checkout-rejected-view .paper-receipt", title: "Причина отказа", description: "Проверьте сумму, банк и имя отправителя. Деньги повторно не отправляйте без проверки." },
        { scope: "overlay", selector: "#btn-retry-payment", title: "Вернуться к оплате", description: "Исправьте данные или обратитесь в поддержку, если перевод уже был отправлен." }
      ]
    },
    setup: {
      title: "Настройка ключа",
      steps: [
        { scope: "overlay", selector: "#opt-this-device", title: "Это устройство", description: "Выберите этот вариант, если ключ нужен на текущем телефоне или компьютере." },
        { scope: "overlay", selector: "#opt-other-device", title: "Другое устройство", description: "Выберите его для отдельного устройства, например ТВ или рабочего компьютера." },
        { scope: "overlay", selector: "#btn-setup-continue", title: "Продолжить", description: "После выбора откроется следующий шаг настройки ключа." }
      ]
    },
    "app-select": {
      title: "Выбор приложения",
      steps: [
        { scope: "overlay", selector: "#app-card-incy", title: "INCY", description: "Рекомендуемое приложение для подключения ключа." },
        { scope: "overlay", selector: "#app-card-karing", title: "Karing", description: "Резервный вариант подключения, если INCY вам не подходит." },
        { scope: "overlay", selector: "#btn-install-app", title: "Установить приложение", description: "Откройте страницу приложения в магазине устройства." }
      ]
    },
    "key-view": {
      title: "Ваш ключ",
      steps: [
        { scope: "overlay", selector: "#key-box-field", title: "Ключ-ссылка", description: "Нажмите на поле, чтобы скопировать ключ для вставки в приложение." },
        { scope: "overlay", selector: "#btn-add-to-app", title: "Добавить в приложение", description: "Попробуйте передать ключ прямо в установленное VPN-приложение." },
        { scope: "overlay", selector: "#btn-key-view-finish", title: "Завершить", description: "Вернитесь к списку устройств после настройки." }
      ]
    },
    "other-device": {
      title: "Другое устройство",
      steps: [
        { scope: "overlay", selector: ".devices-grid", title: "Тип устройства", description: "Выберите платформу, на которой будет работать ключ." },
        { scope: "overlay", selector: "#other-device-key-field", title: "Ключ-ссылка", description: "Скопируйте ссылку и перенесите её на выбранное устройство." }
      ]
    },
    "devices-list": {
      title: "Мои устройства",
      steps: [
        { scope: "overlay", selector: "#devices-slot-summary", title: "Места по тарифу", description: "Здесь видно, сколько устройств уже подключено и сколько мест осталось." },
        { scope: "overlay", selector: "#active-devices-container", title: "Список устройств", description: "Здесь отображаются актуальные устройства и состояние каждого ключа." },
        { scope: "overlay", selector: "#btn-devices-add", title: "Добавить устройство", description: "Откройте мастер настройки для нового устройства, если в тарифе есть свободное место." }
      ]
    },
    "device-detail": {
      title: "Настройка устройства",
      steps: [
        { scope: "overlay", selector: "#btnSelectIncy", title: "Приложение", description: "Выберите приложение для инструкции и загрузки." },
        { scope: "overlay", selector: "#btnDeviceDownload", title: "Скачать приложение", description: "Откройте магазин или страницу загрузки выбранного клиента." },
        { scope: "overlay", selector: "#btnDeviceCopyKey", title: "Скопировать ключ", description: "Вставьте ключ в приложение на этом устройстве." }
      ]
    },
    privacy: {
      title: "Конфиденциальность",
      steps: [
        { scope: "overlay", selector: "#page-privacy-policy .privacy-content, #page-privacy-policy", title: "Политика GhostLink", description: "Здесь собраны правила обработки данных и приватности сервиса." }
      ]
    }
  });

  const ADMIN_OVERLAYS = Object.freeze([
    "page-admin-dashboard",
    "page-admin-payment-settings",
    "page-partner-detail",
    "page-user-detail",
    "page-system-server-detail"
  ]);

  const OVERLAY_HELP = Object.freeze({
    "page-extend": "extend",
    "page-checkout": "checkout",
    "page-setup": "setup",
    "page-app-select": "app-select",
    "page-key-view": "key-view",
    "page-other-device": "other-device",
    "page-device-detail": "device-detail",
    "page-devices-list": "devices-list"
  });

  const TAB_HELP = Object.freeze({
    "tab-home": "home",
    "tab-referral": "referral",
    "tab-settings": "settings"
  });

  const NO_HELP_TABS = Object.freeze(["tab-support"]);

  function resolveHelpKey(context = {}) {
    const { overlayId, tabId, checkoutView, referralMode } = context;
    if (ADMIN_OVERLAYS.includes(overlayId)) return null;
    if (overlayId === "page-checkout") {
      return { pending: "payment-pending", approved: "payment-approved", rejected: "payment-rejected" }[checkoutView] || "checkout";
    }
    if (overlayId) return OVERLAY_HELP[overlayId] || null;
    return TAB_HELP[tabId] || null;
  }

  function getTourForContext(context = {}) {
    const key = resolveHelpKey(context);
    return key && HELP_CONTENT[key] ? HELP_CONTENT[key].steps : null;
  }

  function initContextHelpModule() {
    const documentRef = root?.document;
    if (!documentRef) return null;

    const trigger = documentRef.getElementById("helpButton");
    const backdrop = documentRef.getElementById("contextHelpBackdrop");
    const spotlight = documentRef.getElementById("contextTourSpotlight");
    const shadeTop = documentRef.getElementById("contextHelpShadeTop");
    const shadeLeft = documentRef.getElementById("contextHelpShadeLeft");
    const shadeRight = documentRef.getElementById("contextHelpShadeRight");
    const shadeBottom = documentRef.getElementById("contextHelpShadeBottom");
    const annotation = documentRef.getElementById("contextHelpAnnotation");
    const arrow = documentRef.getElementById("contextHelpArrow");
    const title = documentRef.getElementById("contextHelpTitle");
    const description = documentRef.getElementById("contextHelpDescription");
    const counter = documentRef.getElementById("contextHelpStepCounter");
    const closeButton = documentRef.getElementById("contextHelpClose");
    const previousButton = documentRef.getElementById("contextTourPrevBtn");
    const nextButton = documentRef.getElementById("contextTourNextBtn");

    if (!trigger || !backdrop || !spotlight || !shadeTop || !shadeLeft || !shadeRight || !shadeBottom || !annotation || !title || !description || !counter || !closeButton || !previousButton || !nextButton) return null;
    if (trigger.dataset.contextHelpReady === "true") return null;
    trigger.dataset.contextHelpReady = "true";

    let tourKey = null;
    let steps = [];
    let stepIndex = 0;
    let activeTarget = null;
    let previousFocus = null;

    function visibleOverlay() {
      return Array.from(documentRef.querySelectorAll(".page-overlay")).find((node) => !node.classList.contains("hidden")) || null;
    }

    function context() {
      const overlay = visibleOverlay();
      const tab = documentRef.querySelector(".tab-content.active");
      const mode = documentRef.querySelector(".referral-mode-tab.active");
      let checkoutView = "form";
      if (overlay?.id === "page-checkout") {
        const pending = documentRef.getElementById("checkout-pending-view");
        const approved = documentRef.getElementById("checkout-approved-view");
        const rejected = documentRef.getElementById("checkout-rejected-view");
        if (pending && pending.style.display !== "none") checkoutView = "pending";
        else if (approved && approved.style.display !== "none") checkoutView = "approved";
        else if (rejected && rejected.style.display !== "none") checkoutView = "rejected";
      }
      return { overlayId: overlay?.id || "", tabId: tab?.id || "", referralMode: mode?.dataset.mode || "standard", checkoutView };
    }

    function scopeRoot(step, currentContext) {
      return step.scope === "overlay"
        ? documentRef.getElementById(currentContext.overlayId)
        : documentRef.getElementById(currentContext.tabId);
    }

    function findTarget(step, currentContext) {
      const rootNode = scopeRoot(step, currentContext);
      if (!rootNode) return null;
      return rootNode.querySelector(step.selector);
    }

    function clearTarget() {
      activeTarget?.classList.remove("context-help-target");
      activeTarget = null;
      spotlight.classList.add("hidden");
      annotation.classList.add("hidden");
      shadeTop.style.cssText = "";
      shadeLeft.style.cssText = "";
      shadeRight.style.cssText = "";
      shadeBottom.style.cssText = "";
    }

    function position(target) {
      const rect = target.getBoundingClientRect();
      const margin = 12;
      const cardWidth = Math.min(292, Math.max(240, root.innerWidth - 32));
      const cardHeight = annotation.offsetHeight || 130;
      const left = Math.min(Math.max(16, rect.left + rect.width / 2 - cardWidth / 2), root.innerWidth - cardWidth - 16);
      const belowTop = rect.bottom + 18;
      const aboveTop = rect.top - cardHeight - 18;
      const top = belowTop + cardHeight <= root.innerHeight - 16 ? belowTop : Math.max(16, aboveTop);
      const placement = top < rect.top ? "above" : "below";

      spotlight.style.top = `${Math.max(4, rect.top - margin)}px`;
      spotlight.style.left = `${Math.max(4, rect.left - margin)}px`;
      spotlight.style.width = `${rect.width + margin * 2}px`;
      spotlight.style.height = `${rect.height + margin * 2}px`;
      shadeTop.style.cssText = `top: 0; left: 0; width: 100%; height: ${Math.max(0, rect.top - margin)}px;`;
      shadeLeft.style.cssText = `top: ${Math.max(0, rect.top - margin)}px; left: 0; width: ${Math.max(0, rect.left - margin)}px; height: ${rect.height + margin * 2}px;`;
      shadeRight.style.cssText = `top: ${Math.max(0, rect.top - margin)}px; left: ${Math.min(root.innerWidth, rect.right + margin)}px; right: 0; height: ${rect.height + margin * 2}px;`;
      shadeBottom.style.cssText = `top: ${Math.min(root.innerHeight, rect.bottom + margin)}px; left: 0; width: 100%; bottom: 0;`;
      annotation.style.top = `${top}px`;
      annotation.style.left = `${left}px`;
      annotation.style.width = `${cardWidth}px`;
      annotation.dataset.placement = placement;
      arrow.style.left = `${Math.min(cardWidth - 22, Math.max(22, rect.left + rect.width / 2 - left - 7))}px`;
    }

    function render() {
      clearTarget();
      const step = steps[stepIndex];
      const currentContext = context();
      const target = step && findTarget(step, currentContext);
      if (!step || !target) {
        close({ restoreFocus: false });
        return;
      }
      activeTarget = target;
      activeTarget.classList.add("context-help-target");
      title.textContent = step.title;
      description.textContent = step.description;
      counter.textContent = `${stepIndex + 1} / ${steps.length}`;
      previousButton.hidden = stepIndex === 0;
      nextButton.textContent = stepIndex === steps.length - 1 ? "Понятно" : "Далее";
      target.scrollIntoView?.({ behavior: "auto", block: "nearest" });
      backdrop.classList.remove("hidden");
      spotlight.classList.remove("hidden");
      annotation.classList.remove("hidden");
      requestAnimationFrame(() => position(target));
    }

    function close({ restoreFocus = true } = {}) {
      clearTarget();
      backdrop.classList.add("hidden");
      trigger.setAttribute("aria-expanded", "false");
      documentRef.body.classList.remove("context-help-open");
      annotation.classList.add("hidden");
      if (restoreFocus) previousFocus?.focus?.();
      previousFocus = null;
      tourKey = null;
      steps = [];
      stepIndex = 0;
    }

    function open() {
      const currentContext = context();
      const nextKey = resolveHelpKey(currentContext);
      if (!nextKey || !HELP_CONTENT[nextKey]) return;
      tourKey = nextKey;
      steps = HELP_CONTENT[tourKey].steps;
      stepIndex = 0;
      previousFocus = documentRef.activeElement;
      trigger.setAttribute("aria-expanded", "true");
      documentRef.body.classList.add("context-help-open");
      render();
    }

    function sync() {
      const overlayId = visibleOverlay()?.id || "";
      const isAdmin = ADMIN_OVERLAYS.includes(overlayId);
      const isPrivacy = overlayId === "page-privacy-policy";
      const currentTabId = documentRef.querySelector(".tab-content.active")?.id || "";
      trigger.hidden = isAdmin || isPrivacy || NO_HELP_TABS.includes(currentTabId);
      if ((isAdmin || isPrivacy) && tourKey) close({ restoreFocus: false });
      if (tourKey && resolveHelpKey(context()) !== tourKey) close({ restoreFocus: false });
    }

    trigger.addEventListener("click", open);
    closeButton.addEventListener("click", () => close());
    backdrop.addEventListener("click", () => close());
    previousButton.addEventListener("click", () => { if (stepIndex > 0) { stepIndex -= 1; render(); } });
    nextButton.addEventListener("click", () => { if (stepIndex < steps.length - 1) { stepIndex += 1; render(); } else close(); });
    root.addEventListener("resize", () => { if (activeTarget) position(activeTarget); });
    documentRef.addEventListener("keydown", (event) => { if (event.key === "Escape" && tourKey) close(); });

    const observer = new root.MutationObserver(sync);
    observer.observe(documentRef.querySelector(".app-shell") || documentRef.body, { attributes: true, attributeFilter: ["class", "style"], subtree: true });
    sync();
    return { close, sync, destroy: () => observer.disconnect() };
  }

  const model = { HELP_CONTENT, ADMIN_OVERLAYS, resolveHelpKey, getTourForContext, initContextHelpModule };
  if (typeof module !== "undefined" && module.exports) module.exports = model;
  if (root) {
    const GhostLinkV3 = root.GhostLinkV3 = root.GhostLinkV3 || {};
    GhostLinkV3.ContextHelpModel = model;
    GhostLinkV3.initContextHelpModule = initContextHelpModule;
  }
})(typeof window !== "undefined" ? window : null);
