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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentSettingsModel;
  }

  if (!globalScope?.document) return;

  const GhostLinkV3 = globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
  GhostLinkV3.PaymentSettingsModel = PaymentSettingsModel;

  GhostLinkV3.initAdminPaymentSettingsModule = function initAdminPaymentSettingsModule(dependencies = {}) {
    const { showToast, openOverlay, closeOverlay } = dependencies;
    const localAdminSession = GhostLinkV3.adminMockSession;
    const isLocalAdmin = Boolean(localAdminSession?.isAdmin());
    const openButton = document.getElementById('btnOpenPaymentSettings');
    const page = document.getElementById('page-admin-payment-settings');

    if (!isLocalAdmin) {
      openButton?.closest('#system-payment-settings')?.remove();
      page?.remove();
      return;
    }

    if (!openButton || !page) return;

    const form = document.getElementById('paymentSettingsForm');
    const backButton = document.getElementById('btnPaymentSettingsBack');
    const cancelButton = document.getElementById('btnCancelPaymentSettings');
    const saveButton = document.getElementById('btnSavePaymentSettings');
    const methodInput = document.getElementById('paymentSettingsMethod');
    const bankInput = document.getElementById('paymentSettingsBank');
    const phoneInput = document.getElementById('paymentSettingsPhone');
    const cardInput = document.getElementById('paymentSettingsCard');
    const firstNameInput = document.getElementById('paymentSettingsRecipientFirstName');
    const lastInitialInput = document.getElementById('paymentSettingsRecipientLastInitial');
    const instructionInput = document.getElementById('paymentSettingsInstruction');
    const statusInput = document.getElementById('paymentSettingsStatus');
    const phoneField = document.getElementById('paymentSettingsPhoneField');
    const cardField = document.getElementById('paymentSettingsCardField');
    const formStatus = document.getElementById('paymentSettingsFormStatus');
    const entrySummary = document.getElementById('paymentSettingsEntrySummary');
    const versionLabel = document.getElementById('paymentSettingsVersion');
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
      document.getElementById('paymentSettingsPreviewMethod').textContent = METHODS[profile.method];
      document.getElementById('paymentSettingsPreviewBank').textContent = BANKS[profile.bankKey];
      document.getElementById('paymentSettingsPreviewDestinationLabel').textContent = isCard ? 'Карта' : 'Телефон';
      document.getElementById('paymentSettingsPreviewDestination').textContent = isCard
        ? (profile.cardNumber || 'Не указана')
        : (profile.phone || 'Не указан');
      document.getElementById('paymentSettingsPreviewRecipient').textContent = [
        profile.recipientFirstName || 'Не указано',
        profile.recipientLastInitial ? `${profile.recipientLastInitial}.` : '',
      ].filter(Boolean).join(' ');
      document.getElementById('paymentSettingsPreviewInstruction').textContent = profile.instruction || 'Инструкция не указана';
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

    openButton.addEventListener('click', () => {
      writeForm(currentProfile);
      openOverlay(page);
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

      try {
        localAdminSession.assertAdmin('save_payment_settings');
      } catch {
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
      formStatus.textContent = 'Создаём новую версию реквизитов...';

      try {
        await new Promise((resolve) => globalScope.setTimeout(resolve, 250));
        currentProfile = createVersion(currentProfile, candidate, {
          actor: 'local-admin',
        });
        versions.push(currentProfile);
        activeProfilesCount = currentProfile.status === 'active' ? 1 : activeProfilesCount;
        renderSavedProfile();
        writeForm(currentProfile);
        formStatus.textContent = `Сохранена версия v${currentProfile.version}. Старые заявки не изменены.`;
        showToast?.('Новая версия реквизитов сохранена локально');
      } catch (error) {
        formStatus.textContent = 'Не удалось сохранить. Изменения не применены.';
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
    });
  };
}(typeof window !== 'undefined' ? window : globalThis));
