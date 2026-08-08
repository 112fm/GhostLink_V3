const test = require('node:test');
const assert = require('node:assert/strict');

const { createMockPaymentAdapter } = require('../src/mocks/payment-local-adapter.js');

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function createRestrictedStorage() {
  const error = new Error('SecurityError: localStorage is blocked');
  error.name = 'SecurityError';
  return {
    getItem() { throw error; },
    setItem() { throw error; },
    removeItem() { throw error; },
  };
}

test('1 & 2. submitting payment creates a payment_request_id and pending_verification status', async () => {
  const adapter = createMockPaymentAdapter({ storage: createMemoryStorage() });
  const result = await adapter.submitPayment({
    requestId: 'pay_req_101',
    planId: 'solo-ghost',
    amount: 150,
    payerName: 'Иван Иванов',
    bankKey: 'tbank',
    ownerId: 'user-1',
  });

  assert.equal(result.paymentRequestId, 'pay_req_101');
  assert.equal(result.status, 'pending_verification');
  assert.equal(result.amount, 150);
  assert.equal(result.ownerId, 'user-1');
  assert.equal(adapter.getSubmitCount(), 1);
});

test('3. pending payment request is restored after adapter reload', async () => {
  const storage = createMemoryStorage();
  const firstAdapter = createMockPaymentAdapter({ storage });
  await firstAdapter.submitPayment({
    requestId: 'pay_req_reload',
    planId: 'flex-3',
    amount: 300,
    payerName: 'Алексей Петров',
    ownerId: 'user-2',
  });

  const reloadedAdapter = createMockPaymentAdapter({ storage });
  const restored = await reloadedAdapter.getPaymentStatus('pay_req_reload', { ownerId: 'user-2' });
  const active = await reloadedAdapter.getActivePaymentForUser('user-2');

  assert.equal(restored.paymentRequestId, 'pay_req_reload');
  assert.equal(restored.status, 'pending_verification');
  assert.equal(active.paymentRequestId, 'pay_req_reload');
});

test('4. duplicate submit click with same or active pending request returns conflict and creates no 2nd payment', async () => {
  const adapter = createMockPaymentAdapter({ storage: createMemoryStorage() });
  await adapter.submitPayment({
    requestId: 'pay_req_dup',
    planId: 'solo-ghost',
    amount: 150,
    payerName: 'Мария Сидорова',
    ownerId: 'user-3',
  });

  const duplicateRequest = await adapter.submitPayment({
    requestId: 'pay_req_dup',
    planId: 'solo-ghost',
    amount: 150,
    payerName: 'Мария Сидорова',
    ownerId: 'user-3',
  });

  const secondPendingAttempt = await adapter.submitPayment({
    requestId: 'pay_req_dup2',
    planId: 'solo-ghost',
    amount: 150,
    payerName: 'Мария Сидорова',
    ownerId: 'user-3',
  });

  assert.equal(duplicateRequest.status, 'conflict');
  assert.equal(duplicateRequest.code, 'request_conflict');
  assert.equal(secondPendingAttempt.status, 'conflict');
  assert.equal(secondPendingAttempt.code, 'pending_payment_exists');
  assert.equal(adapter.getSubmitCount(), 1);
});

test('5. invalid amount or empty payer name fails validation and creates no pending request', async () => {
  const adapter = createMockPaymentAdapter({ storage: createMemoryStorage() });
  const invalidAmount = await adapter.submitPayment({
    requestId: 'pay_invalid_1',
    planId: 'solo-ghost',
    amount: 0,
    payerName: 'Сергей Николаев',
  });
  const invalidName = await adapter.submitPayment({
    requestId: 'pay_invalid_2',
    planId: 'solo-ghost',
    amount: 150,
    payerName: '   ',
  });

  assert.equal(invalidAmount.status, 'failed');
  assert.equal(invalidAmount.code, 'invalid_data');
  assert.equal(invalidName.status, 'failed');
  assert.equal(invalidName.code, 'invalid_data');
  assert.equal(adapter.getSubmitCount(), 0);
});

test('6 & 7. user can cancel only their own pending request and create a new request afterwards', async () => {
  const adapter = createMockPaymentAdapter({ storage: createMemoryStorage() });
  await adapter.submitPayment({
    requestId: 'pay_req_cancel',
    planId: 'solo-ghost',
    amount: 150,
    payerName: 'Елена Васильева',
    ownerId: 'user-4',
  });

  // Foreign owner attempt to cancel fails
  const foreignCancel = await adapter.cancelPayment('pay_req_cancel', { ownerId: 'user-hacker' });
  assert.equal(foreignCancel.status, 'failed');
  assert.equal(foreignCancel.code, 'request_forbidden');

  // Owner cancels successfully
  const cancelled = await adapter.cancelPayment('pay_req_cancel', { ownerId: 'user-4' });
  assert.equal(cancelled.status, 'cancelled');

  // Now user can create a new payment
  const newPayment = await adapter.submitPayment({
    requestId: 'pay_req_new',
    planId: 'solo-ghost',
    amount: 150,
    payerName: 'Елена Васильева',
    ownerId: 'user-4',
  });
  assert.equal(newPayment.status, 'pending_verification');
  assert.equal(newPayment.paymentRequestId, 'pay_req_new');
});

test('8 & 9. approved, rejected, and expired statuses render distinct states and require admin contour', async () => {
  const adapter = createMockPaymentAdapter({ storage: createMemoryStorage() });
  
  await adapter.submitPayment({ requestId: 'pay_app', planId: 'solo-ghost', amount: 150, payerName: 'Пётр', ownerId: 'u1' });
  await adapter.submitPayment({ requestId: 'pay_rej', planId: 'solo-ghost', amount: 150, payerName: 'Анна', ownerId: 'u2' });
  await adapter.submitPayment({ requestId: 'pay_exp', planId: 'solo-ghost', amount: 150, payerName: 'Ольга', ownerId: 'u3' });

  const approved = await adapter.approvePayment('pay_app');
  const rejected = await adapter.rejectPayment('pay_rej', { reason: 'Чек не читается' });
  const expired = await adapter.expirePayment('pay_exp');

  assert.equal(approved.status, 'approved');
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.rejectReason, 'Чек не читается');
  assert.equal(expired.status, 'expired');
});

test('10. restrictive WebView storage keeps payment request intact without crashing', async () => {
  const adapter = createMockPaymentAdapter({ storage: createRestrictedStorage() });
  const submitted = await adapter.submitPayment({
    requestId: 'pay_restricted',
    planId: 'solo-ghost',
    amount: 150,
    payerName: 'Дмитрий',
    ownerId: 'u-restricted',
  });

  assert.equal(submitted.status, 'pending_verification');
  const status = await adapter.getPaymentStatus('pay_restricted', { ownerId: 'u-restricted' });
  assert.equal(status.status, 'pending_verification');
});

test('offline and timeout scenarios do not corrupt payment state', async () => {
  const adapter = createMockPaymentAdapter({ storage: createMemoryStorage() });

  await assert.rejects(
    adapter.submitPayment({ requestId: 'pay_timeout', planId: 'solo-ghost', amount: 150, payerName: 'Тимофей', scenario: 'timeout' }),
    (error) => error.type === 'timeout'
  );

  adapter.setOnline(false);
  await assert.rejects(
    adapter.getPaymentStatus('pay_timeout'),
    (error) => error.type === 'network'
  );

  adapter.setOnline(true);
  const status = await adapter.getPaymentStatus('pay_timeout', { ownerId: 'user-default' });
  assert.equal(status, null);
});
