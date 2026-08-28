(function initPaymentSettingsBundle(globalScope) {
  const METHODS = Object.freeze({
    sbp_phone: 'СБП по номеру телефона',
    card_number: 'Перевод по номеру карты',
    phone_number: 'Перевод по номеру телефона',
  });

  const BANKS = Object.freeze({
    tbank: 'Т-Банк',
    ozonbank: 'Озон-банк',
    alfabank: 'Альфа-Банк',
    sberbank: 'Сбербанк',
  });

  function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function normalizeProfile(value = {}) {
    const method = Object.hasOwn(METHODS, value.method) ? value.method : 'sbp_phone';
    const bankKey = Object.hasOwn(BANKS, value.bankKey) ? value.bankKey : 'tbank';
    const initial = cleanText(value.recipientLastInitial).replace(/\./g, '').slice(0, 1).toUpperCase();

    return {
      method,
      bankKey,
      phone: cleanText(value.phone),
      cardNumber: cleanText(value.cardNumber),
      recipientFirstName: cleanText(value.recipientFirstName),
      recipientLastInitial: initial,
      instruction: cleanText(value.instruction),
      status: value.status === 'inactive' ? 'inactive' : 'active',
    };
  }

  function validateProfile(value) {
    const source = value && typeof value === 'object' ? value : {};
    const profile = normalizeProfile(value);
    const errors = {};
    const phoneDigits = profile.phone.replace(/\D/g, '');
    const cardDigits = profile.cardNumber.replace(/\D/g, '');
    const recipientNamePattern = /^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё\-\s']+$/;
    const recipientInitialPattern = /^[A-Za-zА-Яа-яЁё]$/;

    if (!Object.hasOwn(METHODS, source.method)) errors.method = 'Выберите способ перевода';
    if (!Object.hasOwn(BANKS, source.bankKey)) errors.bankKey = 'Выберите банк';
    if (profile.method === 'card_number' && !profile.cardNumber) {
      errors.cardNumber = 'Укажите номер карты';
    } else if (profile.method === 'card_number' && (cardDigits.length < 16 || cardDigits.length > 19)) {
      errors.cardNumber = 'Проверьте номер карты';
    }
    if (profile.method !== 'card_number' && !profile.phone) {
      errors.phone = 'Укажите номер телефона';
    } else if (profile.method !== 'card_number' && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
      errors.phone = 'Проверьте номер телефона';
    }
    if (!profile.recipientFirstName) errors.recipientFirstName = 'Укажите имя получателя';
    else if (!recipientNamePattern.test(profile.recipientFirstName)) errors.recipientFirstName = 'Проверьте имя получателя';
    if (!recipientInitialPattern.test(profile.recipientLastInitial)) errors.recipientLastInitial = 'Укажите одну букву фамилии';
    if (!profile.instruction) errors.instruction = 'Укажите инструкцию для клиента';

    return errors;
  }

  function createVersion(previous, nextValue, metadata = {}) {
    const normalized = normalizeProfile(nextValue);
    const nextVersion = Number(previous?.version || 0) + 1;
    const nextRevision = Number(previous?.revision || 0) + 1;
    const updatedAt = metadata.now || new Date().toISOString();
    const updatedBy = metadata.actor || 'local-admin';

    return Object.freeze({
      ...normalized,
      id: `payment-profile-v${nextVersion}-${updatedAt}`,
      version: nextVersion,
      revision: nextRevision,
      updatedAt,
      updatedBy,
    });
  }

  function createPaymentSnapshot(request, profile) {
    const normalized = normalizeProfile(profile);
    const recipient = `${normalized.recipientFirstName} ${normalized.recipientLastInitial}.`.trim();
    const paymentDetailsSnapshot = Object.freeze({
      profileId: profile.id,
      profileVersion: profile.version,
      method: normalized.method,
      bankKey: normalized.bankKey,
      phone: normalized.phone,
      cardNumber: normalized.cardNumber,
      recipient,
      instruction: normalized.instruction,
    });

    return Object.freeze({
      requestId: request.requestId,
      planId: request.planId,
      amount: request.amount,
      paymentDetailsSnapshot,
    });
  }

  function canDeactivateLastActive(activeProfilesCount) {
    return Number(activeProfilesCount) > 1;
  }

  const PaymentSettingsModel = Object.freeze({
    METHODS,
    BANKS,
    normalizeProfile,
    validateProfile,
    createVersion,
    createPaymentSnapshot,
    canDeactivateLastActive,
  });

  const GhostLinkV3 = globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
  GhostLinkV3.PaymentSettingsModel = PaymentSettingsModel;

  GhostLinkV3.initAdminPaymentSettingsModule = function initAdminPaymentSettingsModule(dependencies = {}) {
    const {
      showToast = () => {},
      openOverlay = () => {},
      closeOverlay = () => {},
      profileSubscription,
      fetch: customFetch,
      apiBase: customApiBase,
      getInitData: customGetInitData,
    } = dependencies;

    const DEFAULT_API_BASE = 'https://api.112prd.ru';
    const apiBase = (customApiBase || profileSubscription?.getApiBase?.() || DEFAULT_API_BASE).replace(/\/+$/, '');
    const fetchImpl = customFetch || (typeof fetch !== 'undefined' ? fetch.bind(globalScope) : globalScope.fetch?.bind(globalScope));
    const getInitData = customGetInitData || (() => globalScope.Telegram?.WebApp?.initData || '');
    const documentRef = dependencies.document || globalScope.document;
    const localAdminSession = dependencies.adminMockSession || GhostLinkV3.adminMockSession || globalScope.GhostLinkV3?.adminMockSession;
    const isLocalAdmin = () => Boolean(
      dependencies.isAdmin ||
      localAdminSession?.isAdmin?.() ||
      profileSubscription?.getCachedProfile?.()?.user?.is_admin ||
      profileSubscription?.getCachedProfile?.()?.profile?.isAdmin ||
      profileSubscription?.getCachedProfile?.()?.profile?.is_admin
    );
    const openButton = documentRef?.getElementById('btnOpenPaymentSettings');
    const page = documentRef?.getElementById('page-admin-payment-settings');

    if (!openButton || !page) return;

    const form = documentRef.getElementById('paymentSettingsForm');
    const backButton = documentRef.getElementById('btnPaymentSettingsBack');
    const cancelButton = documentRef.getElementById('btnCancelPaymentSettings');
    const saveButton = documentRef.getElementById('btnSavePaymentSettings');
    const methodInput = documentRef.getElementById('paymentSettingsMethod');
    const bankInput = documentRef.getElementById('paymentSettingsBank');
    const phoneInput = documentRef.getElementById('paymentSettingsPhone');
    const cardInput = documentRef.getElementById('paymentSettingsCard');
    const firstNameInput = documentRef.getElementById('paymentSettingsRecipientFirstName');
    const lastInitialInput = documentRef.getElementById('paymentSettingsRecipientLastInitial');
    const instructionInput = documentRef.getElementById('paymentSettingsInstruction');
    const statusInput = documentRef.getElementById('paymentSettingsStatus');
    const phoneField = documentRef.getElementById('paymentSettingsPhoneField');
    const cardField = documentRef.getElementById('paymentSettingsCardField');
    const formStatus = documentRef.getElementById('paymentSettingsFormStatus');
    const entrySummary = documentRef.getElementById('paymentSettingsEntrySummary');
    const versionLabel = documentRef.getElementById('paymentSettingsVersion');
    let saving = false;
    let activeProfilesCount = 1;

    let currentProfile = createVersion(null, {
      method: 'sbp_phone',
      bankKey: 'tbank',
      phone: '+7 (000) 000-00-00',
      cardNumber: '0000 0000 0000 0000',
      recipientFirstName: 'Тест',
      recipientLastInitial: 'Т',
      instruction: 'Не указывайте комментарий',
      status: 'active',
    }, {
      now: '2026-07-31T00:00:00.000Z',
      actor: 'local-admin',
    });

    const versions = [currentProfile];

    function readForm() {
      return normalizeProfile({
        method: methodInput.value,
        bankKey: bankInput.value,
        phone: phoneInput.value,
        cardNumber: cardInput.value,
        recipientFirstName: firstNameInput.value,
        recipientLastInitial: lastInitialInput.value,
        instruction: instructionInput.value,
        status: statusInput.value,
      });
    }

    function writeForm(profile) {
      methodInput.value = profile.method;
      bankInput.value = profile.bankKey;
      phoneInput.value = profile.phone;
      cardInput.value = profile.cardNumber;
      firstNameInput.value = profile.recipientFirstName;
      lastInitialInput.value = profile.recipientLastInitial;
      instructionInput.value = profile.instruction;
      statusInput.value = profile.status;
      renderForm();
    }

    function clearErrors() {
      form.querySelectorAll('[data-error-for]').forEach((element) => {
        element.textContent = '';
      });
      form.querySelectorAll('.has-error').forEach((element) => element.classList.remove('has-error'));
    }

    function showErrors(errors) {
      Object.entries(errors).forEach(([field, message]) => {
        const errorElement = form.querySelector(`[data-error-for="${field}"]`);
        if (!errorElement) return;
        errorElement.textContent = message;
        errorElement.closest('.payment-settings-field')?.classList.add('has-error');
      });
    }

    function renderPreview(profile) {
      const isCard = profile.method === 'card_number';
      const previewMethod = documentRef.getElementById('paymentSettingsPreviewMethod');
      const previewBank = documentRef.getElementById('paymentSettingsPreviewBank');
      const previewDestLabel = documentRef.getElementById('paymentSettingsPreviewDestinationLabel');
      const previewDest = documentRef.getElementById('paymentSettingsPreviewDestination');
      const previewRecipient = documentRef.getElementById('paymentSettingsPreviewRecipient');
      const previewInstruction = documentRef.getElementById('paymentSettingsPreviewInstruction');

      if (previewMethod) previewMethod.textContent = METHODS[profile.method];
      if (previewBank) previewBank.textContent = BANKS[profile.bankKey];
      if (previewDestLabel) previewDestLabel.textContent = isCard ? 'Карта' : 'Телефон';
      if (previewDest) {
        previewDest.textContent = isCard
          ? (profile.cardNumber || 'Не указана')
          : (profile.phone || 'Не указан');
      }
      if (previewRecipient) {
        previewRecipient.textContent = [
          profile.recipientFirstName || 'Не указано',
          profile.recipientLastInitial ? `${profile.recipientLastInitial}.` : '',
        ].filter(Boolean).join(' ');
      }
      if (previewInstruction) previewInstruction.textContent = profile.instruction || 'Инструкция не указана';
    }

    function renderForm() {
      const profile = readForm();
      const isCard = profile.method === 'card_number';
      phoneField.classList.toggle('hidden', isCard);
      cardField.classList.toggle('hidden', !isCard);
      renderPreview(profile);
    }

    function renderSavedProfile() {
      versionLabel.textContent = `v${currentProfile.version}`;
      entrySummary.textContent = `${BANKS[currentProfile.bankKey]} · ${METHODS[currentProfile.method]} · ${currentProfile.status === 'active' ? 'активен' : 'неактивен'}`;
    }

    function closeSettings() {
      writeForm(currentProfile);
      clearErrors();
      formStatus.textContent = '';
      closeOverlay(page);
    }

    async function loadLiveSettings() {
      if (typeof fetchImpl !== 'function') return;
      try {
        const token = profileSubscription?.getToken?.() || '';
        const initData = String(getInitData() || '').trim();
        const headers = { Accept: 'application/json' };
        if (token) headers['X-PWA-Token'] = token;
        if (initData) headers['X-Telegram-InitData'] = initData;

        const res = await fetchImpl(`${apiBase}/api/payment/settings`, {
          method: 'GET',
          headers,
          cache: 'no-store',
        });
        if (res && res.ok) {
          const data = await res.json();
          if (data && (data.phone || data.bank || data.recipient)) {
            const rawBank = String(data.bank || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const bankKey = Object.hasOwn(BANKS, rawBank)
              ? rawBank
              : (rawBank === 'alfa' ? 'alfabank' : (rawBank === 'sber' ? 'sberbank' : (rawBank === 'ozon' ? 'ozonbank' : 'tbank')));
            const parts = String(data.recipient || '').trim().split(/\s+/);
            const firstName = parts[0] || '';
            const initial = parts[1] ? parts[1].replace(/\./g, '').slice(0, 1) : '';

            currentProfile = createVersion(currentProfile, {
              ...currentProfile,
              bankKey,
              phone: data.phone || currentProfile.phone,
              recipientFirstName: firstName || currentProfile.recipientFirstName,
              recipientLastInitial: initial || currentProfile.recipientLastInitial,
            }, { actor: 'api' });
            writeForm(currentProfile);
            renderSavedProfile();
          }
        }
      } catch (_) {
        // Fallback to locally cached version
      }
    }

    openButton.addEventListener('click', async () => {
      writeForm(currentProfile);
      openOverlay(page);
      await loadLiveSettings();
    });

    backButton?.addEventListener('click', closeSettings);
    cancelButton?.addEventListener('click', closeSettings);
    form.addEventListener('input', () => {
      clearErrors();
      formStatus.textContent = '';
      renderForm();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (saving) return;

      const isAdmin = Boolean(
        dependencies.isAdmin ||
        localAdminSession?.isAdmin?.() ||
        profileSubscription?.getCachedProfile?.()?.user?.is_admin ||
        profileSubscription?.getSnapshot?.()?.user?.is_admin ||
        isLocalAdmin()
      );

      if (!isAdmin) {
        event.preventDefault();
        showToast('Доступ только для администратора');
        formStatus.textContent = 'Недостаточно прав администратора';
        return;
      }

      clearErrors();
      const candidate = readForm();
      const errors = validateProfile(candidate);
      if (candidate.status === 'inactive' && !canDeactivateLastActive(activeProfilesCount)) {
        errors.status = 'Сначала активируйте другие реквизиты';
      }
      if (Object.keys(errors).length) {
        showErrors(errors);
        formStatus.textContent = 'Проверьте заполненные поля';
        return;
      }

      saving = true;
      saveButton.disabled = true;
      saveButton.textContent = 'Сохраняю...';
      formStatus.textContent = 'Обновляем реквизиты в базе...';

      const recipient = `${candidate.recipientFirstName} ${candidate.recipientLastInitial}.`.trim();
      const payload = {
        phone: candidate.phone,
        bank: candidate.bankKey,
        recipient,
      };

      try {
        const token = profileSubscription?.getToken?.() || '';
        const initData = String(getInitData() || '').trim();
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };
        if (token) headers['X-PWA-Token'] = token;
        if (initData) headers['X-Telegram-InitData'] = initData;

        if (typeof fetchImpl === 'function') {
          const res = await fetchImpl(`${apiBase}/api/admin/payment/settings`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });
          if (!res || !res.ok) {
            let errorMsg = 'Не удалось обновить реквизиты на сервере';
            try {
              const errData = await res.json();
              if (errData?.detail) errorMsg = errData.detail;
            } catch (_) {}
            throw new Error(errorMsg);
          }
        }

        currentProfile = createVersion(currentProfile, candidate, {
          actor: 'admin',
        });
        versions.push(currentProfile);
        activeProfilesCount = currentProfile.status === 'active' ? 1 : activeProfilesCount;
        renderSavedProfile();
        writeForm(currentProfile);
        formStatus.textContent = `Реквизиты успешно сохранены (v${currentProfile.version}).`;
        showToast('Реквизиты успешно обновлены в базе');

        // Sync live checkout if active
        if (globalScope.GhostLinkPayment?.loadSettings) {
          void globalScope.GhostLinkPayment.loadSettings();
        }
      } catch (error) {
        formStatus.textContent = error?.message || 'Не удалось сохранить. Изменения не применены.';
        showToast(error?.message || 'Ошибка сохранения реквизитов');
      } finally {
        saving = false;
        saveButton.disabled = false;
        saveButton.textContent = 'Сохранить изменения';
      }
    });

    renderSavedProfile();
    writeForm(currentProfile);

    GhostLinkV3.PaymentSettingsMock = Object.freeze({
      getActive: () => currentProfile,
      getVersions: () => [...versions],
      createPaymentSnapshot: request => createPaymentSnapshot(request, currentProfile),
      loadLiveSettings,
    });
  };

  const exported = {
    ...PaymentSettingsModel,
    PaymentSettingsModel,
    initAdminPaymentSettingsModule: GhostLinkV3.initAdminPaymentSettingsModule,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
}(typeof window !== 'undefined' ? window : globalThis));
