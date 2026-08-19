const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createMockProfileSubscription } = require('../src/mocks/subscription.js');
const { getLoadingSubscriptionPresentation, getSubscriptionPresentation } = require('../src/modules/home.js');

const root = path.resolve(__dirname, '..');

async function presentationFor(mode) {
  const adapter = createMockProfileSubscription({ mode });
  return getSubscriptionPresentation(await adapter.fetchProfileSubscription());
}

test('active subscription uses one profile snapshot for tariff, days, and device limit', async () => {
  const presentation = await presentationFor('active');

  assert.equal(presentation.state, 'active');
  assert.equal(presentation.planTitle, 'ДЕМО · VIP DIAMOND');
  assert.equal(presentation.remainingDays, 29);
  assert.equal(presentation.progress, 97);
  assert.equal(presentation.deviceLabel, 'Демо: 3 устройства · лимит 5');
  assert.equal(presentation.actionLabel, 'Продлить подписку');
  assert.equal(presentation.isDemo, true);
  assert.match(presentation.planTitle, /^ДЕМО · /);
});

test('loading uses the single subscription line without fake account values', () => {
  const presentation = getLoadingSubscriptionPresentation();

  assert.equal(presentation.state, 'loading');
  assert.equal(presentation.progress, 100);
  assert.equal(presentation.planTitle, '');
  assert.equal(presentation.remainingDays, null);
});

test('low days switch the subscription presentation into a warning state', async () => {
  const presentation = await presentationFor('low-days');

  assert.equal(presentation.state, 'warning');
  assert.equal(presentation.remainingDays, 6);
  assert.equal(presentation.progress, 20);
  assert.equal(presentation.actionLabel, 'Продлить подписку');
});

test('expired subscription does not display stale plan or device data', async () => {
  const presentation = await presentationFor('expired');

  assert.equal(presentation.state, 'expired');
  assert.equal(presentation.planTitle, 'ДЕМО · ВЫБЕРИТЕ ТАРИФ');
  assert.equal(presentation.remainingDays, 0);
  assert.equal(presentation.deviceLabel, 'Устройства появятся после выбора тарифа');
  assert.equal(presentation.actionLabel, 'Выбрать тариф');
});

test('new user receives a tariff-selection state rather than a false active subscription', async () => {
  const presentation = await presentationFor('new-user');

  assert.equal(presentation.state, 'new');
  assert.equal(presentation.remainingDays, 0);
  assert.equal(presentation.actionLabel, 'Выбрать тариф');
});

test('loading and unavailable data use a neutral state without false zeroes', () => {
  const presentation = getSubscriptionPresentation(null);

  assert.equal(presentation.state, 'unavailable');
  assert.equal(presentation.remainingDays, null);
  assert.equal(presentation.deviceLabel, 'Данные временно недоступны');
  assert.equal(presentation.actionLabel, 'Выбрать тариф');
});

test('a real subscription without a server total does not fabricate a progress percentage', () => {
  const presentation = getSubscriptionPresentation({
    isMock: false,
    subscription: {
      state: 'active', active: true, totalDays: null, remainingDays: 10,
      deviceLimit: 3, usedDevices: 1, plan: { title: 'FLEX SQUAD', emoji: '👻' },
    },
  });

  assert.equal(presentation.state, 'active');
  assert.equal(presentation.remainingDays, 10);
  assert.equal(presentation.progress, null);
  assert.equal(presentation.progressKnown, false);
});

test('a real VIP is timeless and keeps the actual device count above its tariff limit', () => {
  const presentation = getSubscriptionPresentation({
    isMock: false,
    subscription: {
      state: 'vip', active: true, isTimeless: true, totalDays: null, startedAt: null,
      remainingDays: null, deviceLimit: 3, usedDevices: 5,
      plan: { title: 'VIP', emoji: '💎' },
    },
  });

  assert.equal(presentation.state, 'vip');
  assert.equal(presentation.planTitle, 'VIP');
  assert.equal(presentation.emoji, '💎');
  assert.equal(presentation.daysValue, 'Без срока');
  assert.equal(presentation.progress, 100);
  assert.equal(presentation.progressKnown, true);
  assert.equal(presentation.deviceLabel, '5 устройств · лимит 3');
});

test('real subscription colours progress only when the API provides a complete duration basis', () => {
  const makePresentation = (remainingDays) => getSubscriptionPresentation({
    isMock: false,
    subscription: {
      state: 'active', active: true, totalDays: 100, startedAt: '2026-08-01T00:00:00Z',
      remainingDays, deviceLimit: 3, usedDevices: 5,
      plan: { title: 'Flex Ghost', emoji: '⚡' },
    },
  });

  assert.equal(makePresentation(51).state, 'active');
  assert.equal(makePresentation(50).state, 'warning');
  assert.equal(makePresentation(19).state, 'critical');
  assert.equal(makePresentation(0).state, 'expired');
});

test('the home bar preserves the tariff name returned by the API', () => {
  const componentStyles = fs.readFileSync(path.join(root, 'src/css/components.css'), 'utf8');
  const tariffRule = componentStyles.match(/\.status-tariff\s*\{[^}]*\}/s)?.[0] || '';

  assert.doesNotMatch(tariffRule, /text-transform:\s*uppercase/);
});

test('pending confirmation is not rendered as a new user or an expired subscription', () => {
  const presentation = getSubscriptionPresentation({
    subscription: { state: 'pending', active: false, totalDays: 0, remainingDays: 0, deviceLimit: 0, usedDevices: 0 },
  });

  assert.equal(presentation.state, 'pending');
  assert.equal(presentation.planTitle, 'ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ');
  assert.equal(presentation.actionLabel, 'Проверить статус');
});

test('authentication and access errors remain distinct and never become a new user state', () => {
  const unauthorized = getSubscriptionPresentation({ error: { type: 'auth', status: 401 } });
  const forbidden = getSubscriptionPresentation({ error: { type: 'auth', status: 403 } });

  assert.equal(unauthorized.state, 'auth');
  assert.equal(forbidden.state, 'denied');
  assert.notEqual(unauthorized.state, 'new');
  assert.notEqual(forbidden.state, 'new');
});

test('denied access hides client club actions instead of exposing a stale club interface', () => {
  const homeSource = fs.readFileSync(path.join(root, 'src/modules/home.js'), 'utf8');
  const componentStyles = fs.readFileSync(path.join(root, 'src/css/components.css'), 'utf8');

  assert.match(homeSource, /is-access-denied/);
  assert.match(componentStyles, /\.app-shell\.is-access-denied \.home-bottom-content/);
  assert.match(componentStyles, /\.app-shell\.is-access-denied \.bottom-nav/);
});

test('timeout and network errors do not turn into an expired subscription or fake device data', () => {
  const timeout = getSubscriptionPresentation({ error: { type: 'timeout' } });
  const network = getSubscriptionPresentation({ error: { type: 'network' } });

  assert.equal(timeout.state, 'unavailable');
  assert.equal(timeout.remainingDays, null);
  assert.equal(timeout.deviceLabel, 'Загрузка заняла слишком долго. Попробуйте ещё раз.');
  assert.equal(network.state, 'unavailable');
  assert.equal(network.remainingDays, null);
  assert.equal(network.deviceLabel, 'Не удалось связаться с GhostLink. Проверьте подключение');
});

test('offline and timeout states reject without replacing the saved mock scenario', async () => {
  const adapter = createMockProfileSubscription();
  const active = await adapter.fetchProfileSubscription();

  adapter.setMode('offline');
  await assert.rejects(adapter.fetchProfileSubscription(), (error) => error.type === 'network');
  adapter.setMode('timeout');
  await assert.rejects(adapter.fetchProfileSubscription(), (error) => error.type === 'timeout');
  adapter.setMode('active');

  const retried = await adapter.fetchProfileSubscription();
  assert.deepEqual(retried, active);
});

test('parallel profile loads share one local request and do not create payment activity', async () => {
  const adapter = createMockProfileSubscription({ delayMs: 5 });
  const [first, second] = await Promise.all([
    adapter.fetchProfileSubscription(),
    adapter.fetchProfileSubscription(),
  ]);

  assert.deepEqual(first, second);
  assert.equal(adapter.getFetchCount(), 1);
});

test('profile subscription block is local-only and home buttons keep local destinations', () => {
  const mockSource = fs.readFileSync(path.join(root, 'src/mocks/subscription.js'), 'utf8');
  const homeSource = fs.readFileSync(path.join(root, 'src/modules/home.js'), 'utf8');
  const subscriptionSource = fs.readFileSync(path.join(root, 'src/modules/subscription.js'), 'utf8');
  const devicesSource = fs.readFileSync(path.join(root, 'src/modules/devices.js'), 'utf8');
  const homeTemplate = fs.readFileSync(path.join(root, 'src/templates/pages/home.html'), 'utf8');
  const componentStyles = fs.readFileSync(path.join(root, 'src/css/components.css'), 'utf8');

  assert.doesNotMatch(mockSource, /\bfetch\s*\(|https?:\/\//);
  assert.doesNotMatch(homeSource, /\bfetch\s*\(|https?:\/\//);
  assert.match(homeTemplate, /class="bento-card bento-extend"/);
  assert.match(homeTemplate, /class="bento-card bento-setup"/);
  assert.match(subscriptionSource, /openOverlay\(pageExtend\)/);
  assert.match(subscriptionSource, /openOverlay\(pageCheckout\)/);
  assert.match(devicesSource, /bentoSetupBtn/);
  assert.match(devicesSource, /openOverlay\(pageSetup\)/);
  assert.doesNotMatch(homeTemplate, /Профиль загружается|VIP DIAMOND|29 дней/i);
  assert.match(homeTemplate, /is-subscription-loading/);
  assert.match(componentStyles, /subscription-loading-sweep/);
});
