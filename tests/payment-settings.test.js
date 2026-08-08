const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const modelPath = path.join(root, 'src/modules/admin-payment-settings.js');
const indexPath = path.join(root, 'index.html');
const paymentConfigPath = path.join(root, 'src/payment-config.js');

function loadModel() {
  assert.equal(
    fs.existsSync(modelPath),
    true,
    'admin-payment-settings.js must exist',
  );
  delete require.cache[require.resolve(modelPath)];
  return require(modelPath);
}

test('payment settings model validates method-specific destination fields', () => {
  const model = loadModel();
  const base = {
    method: 'sbp_phone',
    bankKey: 'tbank',
    phone: '+7 (000) 000-00-00',
    cardNumber: '',
    recipientFirstName: 'Тест',
    recipientLastInitial: 'Т',
    instruction: 'Не указывайте комментарий',
    status: 'active',
  };

  assert.deepEqual(model.validateProfile(base), {});
  assert.equal(model.validateProfile({ ...base, phone: '' }).phone, 'Укажите номер телефона');
  assert.deepEqual(model.validateProfile({
    ...base,
    method: 'card_number',
    phone: '',
    cardNumber: '0000 0000 0000 0000',
  }), {});
  assert.equal(model.validateProfile({
    ...base,
    method: 'card_number',
    phone: '',
    cardNumber: '',
  }).cardNumber, 'Укажите номер карты');
  assert.equal(model.validateProfile({ ...base, method: 'unknown' }).method, 'Выберите способ перевода');
  assert.equal(model.validateProfile({ ...base, bankKey: 'unknown' }).bankKey, 'Выберите банк');
  assert.equal(model.validateProfile({ ...base, phone: '123' }).phone, 'Проверьте номер телефона');
  assert.equal(model.validateProfile({
    ...base,
    method: 'card_number',
    cardNumber: '1234',
  }).cardNumber, 'Проверьте номер карты');
  assert.equal(model.validateProfile({ ...base, recipientFirstName: '1' }).recipientFirstName, 'Проверьте имя получателя');
  assert.equal(model.validateProfile({ ...base, recipientLastInitial: '1' }).recipientLastInitial, 'Укажите одну букву фамилии');
});

test('creating a version does not mutate the previous version', () => {
  const model = loadModel();
  const previous = Object.freeze({
    id: 'payment-profile-v1',
    version: 1,
    revision: 1,
    method: 'sbp_phone',
    bankKey: 'tbank',
    phone: '+7 (000) 000-00-00',
    cardNumber: '',
    recipientFirstName: 'Тест',
    recipientLastInitial: 'Т',
    instruction: 'Не указывайте комментарий',
    status: 'active',
  });

  const next = model.createVersion(previous, {
    ...previous,
    bankKey: 'sberbank',
    phone: '+7 (000) 000-00-01',
  }, {
    now: '2026-07-31T12:00:00.000Z',
    actor: 'local-admin',
  });

  assert.equal(previous.bankKey, 'tbank');
  assert.equal(next.bankKey, 'sberbank');
  assert.equal(next.version, 2);
  assert.equal(next.revision, 2);
  assert.notEqual(next.id, previous.id);
});

test('payment request keeps an immutable payment details snapshot', () => {
  const model = loadModel();
  const profile = {
    id: 'payment-profile-v1',
    version: 1,
    method: 'sbp_phone',
    bankKey: 'tbank',
    phone: '+7 (000) 000-00-00',
    cardNumber: '',
    recipientFirstName: 'Тест',
    recipientLastInitial: 'Т',
    instruction: 'Не указывайте комментарий',
    status: 'active',
  };

  const request = model.createPaymentSnapshot({
    requestId: 'payment-request-1',
    planId: 'solo-ghost',
    amount: 150,
  }, profile);
  profile.phone = '+7 (000) 000-00-99';

  assert.equal(request.paymentDetailsSnapshot.phone, '+7 (000) 000-00-00');
  assert.equal(Object.isFrozen(request.paymentDetailsSnapshot), true);
  assert.equal(request.amount, 150);
});

test('the final active payment profile cannot be deactivated', () => {
  const model = loadModel();
  assert.equal(model.canDeactivateLastActive(1), false);
  assert.equal(model.canDeactivateLastActive(2), true);
});

test('System tab exposes a dedicated payment settings overlay contract', () => {
  const html = fs.readFileSync(indexPath, 'utf8');
  const requiredIds = [
    'btnOpenPaymentSettings',
    'page-admin-payment-settings',
    'paymentSettingsMethod',
    'paymentSettingsBank',
    'paymentSettingsPhone',
    'paymentSettingsCard',
    'paymentSettingsRecipientFirstName',
    'paymentSettingsRecipientLastInitial',
    'paymentSettingsInstruction',
    'paymentSettingsStatus',
    'btnSavePaymentSettings',
  ];

  requiredIds.forEach((id) => {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  });
  assert.match(html, /admin-payment-settings\.js\?v=3/);
});

test('checkout adapter renders a request snapshot without persisting it', () => {
  const source = fs.readFileSync(paymentConfigPath, 'utf8');
  const context = {
    window: {},
    localStorage: {
      removeItem() {},
    },
  };
  vm.runInNewContext(source, context);

  assert.equal(typeof context.window.GhostLinkPaymentConfig.fromSnapshot, 'function');
  const snapshot = Object.freeze({
    method: 'card_number',
    bankKey: 'sberbank',
    phone: '',
    cardNumber: '0000 0000 0000 0000',
    recipient: 'Тест Т.',
    instruction: 'Не указывайте комментарий',
  });
  const view = context.window.GhostLinkPaymentConfig.fromSnapshot(snapshot);

  assert.equal(view.destination, '0000 0000 0000 0000');
  assert.equal(view.destinationLabel, 'Карта');
  assert.equal(view.recipient, 'Тест Т.');
  assert.equal(context.window.GhostLinkPaymentConfig.get().phone, '+7 (000) 000-00-00');
});
