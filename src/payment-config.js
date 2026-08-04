(function () {
  const STORAGE_KEY = 'ghostlink_v3_payment_details';
  const BANKS = Object.freeze({
    tbank: 'Т-Банк',
    ozonbank: 'Озон-банк',
    alfabank: 'Альфа-Банк',
    sberbank: 'Сбербанк',
  });
  // These values are intentionally fictional. Real payment details must come
  // from the API only after it authorizes an active payment request.
  const DEFAULTS = Object.freeze({
    bankKey: 'tbank',
    phone: '+7 (000) 000-00-00',
    recipient: 'Тестовый получатель',
  });

  function isBankKey(value) {
    return Object.prototype.hasOwnProperty.call(BANKS, value);
  }

  function normalizeDetails(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      bankKey: isBankKey(source.bankKey) ? source.bankKey : DEFAULTS.bankKey,
      phone: typeof source.phone === 'string' && source.phone.trim()
        ? source.phone.trim()
        : DEFAULTS.phone,
      recipient: typeof source.recipient === 'string' && source.recipient.trim()
        ? source.recipient.trim()
        : DEFAULTS.recipient,
    };
  }

  function clearLegacyDetails() {
    try {
      // Do not let a prior local prototype keep personal payment details.
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Storage can be unavailable in a private or embedded WebView.
    }
  }

  function read() {
    return { ...DEFAULTS };
  }

  function fromSnapshot(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const method = source.method === 'card_number'
      ? 'card_number'
      : (source.method === 'phone_number' ? 'phone_number' : 'sbp_phone');
    const isCard = method === 'card_number';
    const destination = isCard
      ? String(source.cardNumber || '').trim()
      : String(source.phone || '').trim();

    return Object.freeze({
      method,
      bankKey: isBankKey(source.bankKey) ? source.bankKey : DEFAULTS.bankKey,
      phone: String(source.phone || '').trim(),
      cardNumber: String(source.cardNumber || '').trim(),
      destination: destination || DEFAULTS.phone,
      destinationLabel: isCard ? 'Карта' : 'Телефон',
      recipient: String(source.recipient || DEFAULTS.recipient).trim(),
      instruction: String(source.instruction || '').trim(),
    });
  }

  function write(nextDetails) {
    // Only the non-sensitive bank choice remains configurable in the mock.
    // Phone and recipient will be supplied by the authorized payment API.
    return normalizeDetails({ bankKey: nextDetails?.bankKey });
  }

  function reset() {
    clearLegacyDetails();
    return { ...DEFAULTS };
  }

  clearLegacyDetails();

  window.GhostLinkPaymentConfig = Object.freeze({
    banks: BANKS,
    defaults: DEFAULTS,
    get: read,
    fromSnapshot,
    set: write,
    reset,
  });
}());
