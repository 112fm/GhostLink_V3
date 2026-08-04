(() => {
const GhostLinkV3 = window.GhostLinkV3 = window.GhostLinkV3 || {};

GhostLinkV3.initDevicesModule = function initDevicesModule(dependencies = {}) {
  const { showToast, copyText, openOverlay, closeOverlay, returnToHome } = dependencies;

  // Local-only operation adapter. The future API must preserve this request_id contract.
  const deviceOperations = dependencies.deviceOperations || GhostLinkV3.createMockDeviceOperations?.();
  // Mutations are deliberately separate from creation: future API calls need
  // independent request_id tracking and must never retry a destructive POST.
  const deviceMutations = dependencies.deviceMutations || GhostLinkV3.createMockDeviceMutations?.();
  // Local-only list adapter. It mirrors the future server snapshot contract.
  const deviceList = dependencies.deviceList || GhostLinkV3.createMockDeviceList?.();
  const DEVICE_OPERATION_STATE_KEY = 'ghostlink-v3-device-operation-v1';
  const DEVICE_MUTATION_STATE_KEY = 'ghostlink-v3-device-mutations-v1';
  const DEVICE_POLL_DELAY_MS = 600;
  let currentDeviceOperation = null;
  let devicePollingTimer = null;
  let lastConfirmedDeviceList = null;
  let deviceListLoadPromise = null;
  let deviceListRequestSequence = 0;
  const pendingDeviceMutations = new Map(Object.entries(readSavedDeviceMutations()));

// Key Setup Screen (#page-setup) Logic
const pageSetup = document.getElementById('page-setup');
const btnSetupBack = document.getElementById('btn-setup-back');
const bentoSetupBtn = document.querySelector('.bento-setup');
const setupContinueBtn = document.getElementById('btn-setup-continue');
const setupRadioInputs = document.querySelectorAll('input[name="setup-target"]');

// Devices List Screen (#page-devices-list) Logic
const pageDevicesList = document.getElementById('page-devices-list');
const btnSettingsDevices = document.getElementById('btnSettingsDevices');
const btnDevicesBack = document.getElementById('btn-devices-back');
const btnDevicesRefresh = document.getElementById('btn-devices-refresh');
const btnDevicesAdd = document.getElementById('btn-devices-add');
const activeDevicesContainer = document.getElementById('active-devices-container');
const devicesListStatus = document.getElementById('devices-list-status');
const devicesSlotSummary = document.getElementById('devices-slot-summary');
const devicesSlotFree = document.getElementById('devices-slot-free');
const devicesEmptyState = document.getElementById('devices-empty-state');
const devicesUnavailableState = document.getElementById('devices-unavailable-state');
const settingsDevicesSubtitle = document.getElementById('settings-devices-subtitle');

function getDeviceEmoji(platform) {
  return { phone: '📱', laptop: '💻', tv: '📺' }[platform] || '🔑';
}

function setDevicesListStatus(message, tone = 'neutral') {
  if (!devicesListStatus) return;
  devicesListStatus.textContent = message;
  devicesListStatus.dataset.tone = tone;
}

function renderDeviceCards(devices) {
  if (!activeDevicesContainer) return;
  activeDevicesContainer.replaceChildren();

  devices.forEach((device) => {
    const card = document.createElement('article');
    card.className = 'device-apple-card';
    card.dataset.deviceId = device.id;

    const left = document.createElement('div');
    left.className = 'device-apple-left';
    const emoji = document.createElement('div');
    emoji.className = 'device-badge-emoji';
    emoji.textContent = getDeviceEmoji(device.platform);
    const info = document.createElement('div');
    info.className = 'device-apple-info';
    const name = document.createElement('span');
    name.className = 'device-apple-name';
    name.textContent = device.name;
    const meta = document.createElement('span');
    meta.className = 'device-apple-meta';
    meta.textContent = device.app ? `Подключено через ${device.app}` : 'Приложение не выбрано';
    info.append(name);
    if (device.isCurrent) {
      const row = document.createElement('div');
      row.className = 'device-apple-sub-row';
      const badge = document.createElement('span');
      badge.className = 'device-is-this-badge';
      badge.textContent = 'Это устройство';
      row.append(badge, meta);
      info.append(row);
    } else {
      info.append(meta);
    }
    left.append(emoji, info);

    const right = document.createElement('div');
    right.className = 'device-apple-right';
    const stats = document.createElement('div');
    stats.className = 'device-right-stats';
    const activity = document.createElement('span');
    activity.className = 'device-activity';
    const dot = document.createElement('span');
    dot.className = `device-status-dot${device.status === 'online' ? '' : ' offline'}`;
    const activityText = document.createElement('span');
    activityText.textContent = device.lastActive;
    activity.append(dot, activityText);
    const traffic = document.createElement('span');
    traffic.className = 'device-traffic-chip';
    traffic.textContent = device.traffic;
    stats.append(activity, traffic);
    right.append(stats);

    const actions = document.createElement('div');
    actions.className = 'device-card-actions';
    const isBusy = pendingDeviceMutations.has(device.id);
    [
      ['rotate', 'Обновить ключ'],
      ['reset', 'Сбросить'],
      ['remove', 'Удалить'],
    ].forEach(([type, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `device-card-action device-card-action--${type}`;
      button.textContent = isBusy ? 'Операция выполняется…' : label;
      button.disabled = isBusy;
      button.addEventListener('click', () => startDeviceMutation(device, type));
      actions.append(button);
    });
    right.append(actions);
    card.append(left, right);
    activeDevicesContainer.append(card);
  });
}

function renderDeviceList(snapshot) {
  lastConfirmedDeviceList = snapshot;
  const isEmpty = snapshot.status === 'empty';
  const isAtLimit = snapshot.status === 'limit';
  renderDeviceCards(snapshot.devices);

  if (devicesSlotSummary) devicesSlotSummary.textContent = `${snapshot.usedSlots} из ${snapshot.deviceLimit} занято`;
  if (devicesSlotFree) devicesSlotFree.textContent = snapshot.freeSlots > 0
    ? `Свободно мест: ${snapshot.freeSlots}`
    : 'Все места по тарифу заняты';
  if (settingsDevicesSubtitle) settingsDevicesSubtitle.textContent = `Подключено: ${snapshot.usedSlots} из ${snapshot.deviceLimit}`;
  devicesEmptyState?.classList.toggle('hidden', !isEmpty);
  devicesUnavailableState?.classList.add('hidden');
  if (btnDevicesAdd) {
    btnDevicesAdd.disabled = isAtLimit;
    btnDevicesAdd.textContent = isAtLimit ? 'Лимит устройств достигнут' : 'Добавить устройство';
  }
  setDevicesListStatus(isAtLimit
    ? 'Свободных мест нет. Удалите или сбросьте ненужное устройство.'
    : isEmpty ? 'Список загружен. Можно добавить первое устройство.' : 'Список устройств обновлён.');
  resumeSavedDeviceMutations();
}

function renderDeviceListError(error) {
  const message = error?.type === 'timeout'
    ? 'Обновление заняло слишком долго. Попробуйте ещё раз.'
    : 'Нет связи. Проверьте подключение и обновите список позже.';
  if (lastConfirmedDeviceList) {
    renderDeviceCards(lastConfirmedDeviceList.devices);
    devicesUnavailableState?.classList.remove('hidden');
    setDevicesListStatus(`${message} Показываем последние подтверждённые данные.`, 'warning');
  } else {
    activeDevicesContainer?.replaceChildren();
    devicesEmptyState?.classList.add('hidden');
    devicesUnavailableState?.classList.remove('hidden');
    setDevicesListStatus(message, 'error');
  }
}

function readSavedDeviceMutations() {
  try {
    const raw = window.localStorage?.getItem(DEVICE_MUTATION_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDeviceMutations() {
  try {
    window.localStorage?.setItem(
      DEVICE_MUTATION_STATE_KEY,
      JSON.stringify(Object.fromEntries(pendingDeviceMutations)),
    );
  } catch {
    // The current session still blocks duplicate destructive actions.
  }
}

function getMutationCopy(type) {
  return {
    rotate: { pending: 'Обновляем ключ…', success: 'Ключ обновлён. Подключите его заново.' },
    reset: { pending: 'Сбрасываем устройство…', success: 'Устройство сброшено. Нужна повторная настройка.' },
    remove: { pending: 'Удаляем устройство…', success: 'Устройство удалено.' },
  }[type] || { pending: 'Выполняем операцию…', success: 'Операция завершена.' };
}

function applyMutationToSnapshot(snapshot, result) {
  if (!snapshot) return null;
  const next = JSON.parse(JSON.stringify(snapshot));
  const index = next.devices.findIndex((device) => device.id === result.deviceId);
  if (index < 0) return next;

  if (result.type === 'remove') {
    next.devices.splice(index, 1);
  } else if (result.type === 'rotate') {
    next.devices[index] = {
      ...next.devices[index],
      setupToken: `mock-rotated-${result.requestId}`,
      status: 'setup',
      lastActive: 'Ключ обновлён',
    };
  } else if (result.type === 'reset') {
    next.devices[index] = {
      ...next.devices[index],
      app: 'Не выбрано',
      status: 'setup',
      lastActive: 'Нужна повторная настройка',
      traffic: '0 Б',
    };
  }

  next.usedSlots = next.devices.length;
  next.freeSlots = Math.max(0, next.deviceLimit - next.usedSlots);
  next.status = next.usedSlots === 0 ? 'empty' : next.freeSlots === 0 ? 'limit' : 'loaded';
  return next;
}

function scheduleDeviceMutationCheck(deviceId, requestId) {
  window.setTimeout(() => checkDeviceMutationStatus(deviceId, requestId), DEVICE_POLL_DELAY_MS);
}

function resumeSavedDeviceMutations() {
  pendingDeviceMutations.forEach((operation, deviceId) => {
    if (!['preparing', 'accepted', 'processing', 'unknown', 'conflict'].includes(operation.phase)) return;
    if (operation.resumeScheduled) return;
    operation.resumeScheduled = true;
    saveDeviceMutations();
    window.setTimeout(() => checkDeviceMutationStatus(deviceId, operation.requestId), 0);
  });
}

async function checkDeviceMutationStatus(deviceId, requestId) {
  const operation = pendingDeviceMutations.get(deviceId);
  if (!operation || operation.requestId !== requestId || !deviceMutations) return;
  operation.resumeScheduled = false;

  try {
    const result = await deviceMutations.getStatus(requestId);
    if (!result) {
      operation.phase = 'unknown';
      saveDeviceMutations();
      renderDeviceCards(lastConfirmedDeviceList?.devices || []);
      setDevicesListStatus('Нет ответа по операции. Нажмите действие ещё раз только после проверки статуса.', 'warning');
      return;
    }
    handleDeviceMutationResult(deviceId, result);
  } catch (error) {
    operation.phase = 'unknown';
    saveDeviceMutations();
    renderDeviceCards(lastConfirmedDeviceList?.devices || []);
    setDevicesListStatus(error?.type === 'timeout'
      ? 'Проверка операции заняла слишком долго. Устройство не изменено на экране.'
      : 'Нет связи. Операция сохранена, повторный запуск заблокирован.', 'warning');
  }
}

function finishDeviceMutation(deviceId, result) {
  const copy = getMutationCopy(result.type);
  const applied = deviceList?.applyMutation?.(result);
  pendingDeviceMutations.delete(deviceId);
  saveDeviceMutations();

  if (!applied) {
    setDevicesListStatus('Операция подтверждена, но локальный список нужно обновить.', 'warning');
    loadDeviceList();
    return;
  }

  const optimisticSnapshot = applyMutationToSnapshot(lastConfirmedDeviceList, result);
  if (optimisticSnapshot) renderDeviceList(optimisticSnapshot);
  showToast(copy.success);

  loadDeviceList().then((snapshot) => {
    if (snapshot) {
      setDevicesListStatus(`${copy.success} Список обновлён.`);
    } else {
      setDevicesListStatus(`${copy.success} Список временно не обновился.`, 'warning');
    }
  });
}

function handleDeviceMutationResult(deviceId, result) {
  const operation = pendingDeviceMutations.get(deviceId);
  if (!operation || result?.requestId !== operation.requestId) return;

  if (result.status === 'accepted' || result.status === 'processing' || result.status === 'conflict') {
    operation.phase = result.status;
    saveDeviceMutations();
    renderDeviceCards(lastConfirmedDeviceList?.devices || []);
    if (result.status === 'conflict') {
      setDevicesListStatus('Операция уже есть. Проверяем её статус…', 'warning');
    }
    scheduleDeviceMutationCheck(deviceId, operation.requestId);
    return;
  }

  if (result.status === 'succeeded') {
    finishDeviceMutation(deviceId, result);
    return;
  }

  pendingDeviceMutations.delete(deviceId);
  saveDeviceMutations();
  renderDeviceCards(lastConfirmedDeviceList?.devices || []);
  setDevicesListStatus(result?.message || 'Операция не выполнена. Список не изменён.', 'error');
}

async function startDeviceMutation(device, type) {
  if (!deviceMutations || !device?.id) {
    setDevicesListStatus('Локальный контур операции не загрузился.', 'error');
    return;
  }
  if (pendingDeviceMutations.has(device.id)) {
    const operation = pendingDeviceMutations.get(device.id);
    checkDeviceMutationStatus(device.id, operation.requestId);
    return;
  }
  if (typeof window.confirm === 'function') {
    let confirmMsg = '';
    if (type === 'remove') {
      confirmMsg = `Удалить устройство «${device.name}»? Ключ перестанет работать, слот будет освобождён.`;
    } else if (type === 'reset') {
      confirmMsg = `Сбросить устройство «${device.name}»? Настройки будут сброшены, потребуется повторная настройка.`;
    } else if (type === 'rotate') {
      confirmMsg = `Обновить ключ для «${device.name}»? Старый ключ перестанет работать на всех устройствах.`;
    }
    if (confirmMsg && !window.confirm(confirmMsg)) {
      return;
    }
  }

  const operation = { requestId: createRequestId(), type, deviceId: device.id, phase: 'preparing' };
  pendingDeviceMutations.set(device.id, operation);
  saveDeviceMutations();
  renderDeviceCards(lastConfirmedDeviceList?.devices || []);
  setDevicesListStatus(getMutationCopy(type).pending);

  try {
    const result = await deviceMutations.start(operation);
    handleDeviceMutationResult(device.id, result);
  } catch (error) {
    operation.phase = 'unknown';
    saveDeviceMutations();
    renderDeviceCards(lastConfirmedDeviceList?.devices || []);
    setDevicesListStatus(error?.type === 'timeout'
      ? 'Нет ответа по операции. Повторно не запускаем: проверяем сохранённый статус.'
      : 'Нет связи. Операция сохранена, повторный запуск заблокирован.', 'warning');
  }
}

function loadDeviceList() {
  if (!deviceList || deviceListLoadPromise) return deviceListLoadPromise;
  const requestSequence = ++deviceListRequestSequence;
  setDevicesListStatus(lastConfirmedDeviceList ? 'Обновляем список устройств…' : 'Получаем список устройств…');
  if (btnDevicesRefresh) btnDevicesRefresh.disabled = true;

  deviceListLoadPromise = deviceList.fetchList()
    .then((snapshot) => {
      if (requestSequence === deviceListRequestSequence) renderDeviceList(snapshot);
      return snapshot;
    })
    .catch((error) => {
      if (requestSequence === deviceListRequestSequence) renderDeviceListError(error);
      return null;
    })
    .finally(() => {
      if (requestSequence === deviceListRequestSequence && btnDevicesRefresh) btnDevicesRefresh.disabled = false;
      deviceListLoadPromise = null;
    });
  return deviceListLoadPromise;
}

if (btnSettingsDevices && pageDevicesList) {
  btnSettingsDevices.addEventListener('click', () => {
    openOverlay(pageDevicesList);
    loadDeviceList();
  });
}

if (btnDevicesBack && pageDevicesList) {
  btnDevicesBack.addEventListener('click', () => closeOverlay(pageDevicesList));
}

if (btnDevicesRefresh) btnDevicesRefresh.addEventListener('click', loadDeviceList);

if (btnDevicesAdd && pageSetup) {
  btnDevicesAdd.addEventListener('click', () => {
    if (lastConfirmedDeviceList?.freeSlots === 0) {
      showToast('Свободных мест нет. Новое устройство не создаём.');
      return;
    }
    openOverlay(pageSetup);
  });
}

function createRequestId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readSavedDeviceOperation() {
  try {
    const raw = window.localStorage?.getItem(DEVICE_OPERATION_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDeviceOperation() {
  try {
    if (currentDeviceOperation) {
      window.localStorage?.setItem(DEVICE_OPERATION_STATE_KEY, JSON.stringify(currentDeviceOperation));
    } else {
      window.localStorage?.removeItem(DEVICE_OPERATION_STATE_KEY);
    }
  } catch {
    // Storage can be unavailable in restrictive WebViews; the active session still stays safe.
  }
}

function setSetupOperationUi(phase) {
  if (!setupContinueBtn) return;
  const labels = {
    preparing: 'Подготавливаем операцию...',
    accepted: 'Операция выполняется...',
    processing: 'Проверяем создание...',
    unknown: 'Проверить статус',
    conflict: 'Проверить статус',
    replaying: 'Получаем данные ключа...',
    result_pending: 'Проверить статус',
    failed: 'Попробовать снова',
    limit: 'Освободить место',
    succeeded: 'Продолжить',
    idle: 'Продолжить',
  };
  const isPolling = ['preparing', 'accepted', 'processing', 'replaying'].includes(phase);
  setupContinueBtn.disabled = isPolling;
  setupContinueBtn.setAttribute('aria-busy', String(isPolling));
  setupContinueBtn.querySelector('span')?.replaceChildren(document.createTextNode(labels[phase] || labels.idle));
}

function stopDevicePolling() {
  if (devicePollingTimer) window.clearTimeout(devicePollingTimer);
  devicePollingTimer = null;
}

function setMockDeviceToken(device) {
  if (!device?.setupToken) return;
  const mockToken = `mock://${device.setupToken}`;
  const keyViewToken = document.getElementById('user-key-url');
  const otherDeviceToken = document.getElementById('other-device-key-text');
  if (keyViewToken) keyViewToken.textContent = mockToken;
  if (otherDeviceToken) otherDeviceToken.textContent = mockToken;
}

function finishDeviceOperation(result) {
  stopDevicePolling();
  currentDeviceOperation = {
    ...currentDeviceOperation,
    phase: 'succeeded',
    resultShown: currentDeviceOperation?.resultShown || false,
  };
  setMockDeviceToken(result.device);
  deviceList?.addOperationDevice?.({
    requestId: currentDeviceOperation.requestId,
    target: currentDeviceOperation.target,
    device: result.device,
  });
  if (!pageDevicesList?.classList.contains('hidden')) loadDeviceList();
  setSetupOperationUi('succeeded');

  if (!currentDeviceOperation.resultShown) {
    currentDeviceOperation.resultShown = true;
    saveDeviceOperation();
    showToast('Макет устройства готов. Реальный ключ не выпускался.');
    const nextPage = currentDeviceOperation.target === 'other-device'
      ? document.getElementById('page-other-device')
      : document.getElementById('page-app-select');
    if (nextPage) openOverlay(nextPage);
    return;
  }

  saveDeviceOperation();
}

function scheduleDeviceStatusCheck() {
  stopDevicePolling();
  devicePollingTimer = window.setTimeout(() => checkDeviceOperationStatus(), DEVICE_POLL_DELAY_MS);
}

function keepDeviceResultPending(message) {
  if (!currentDeviceOperation) return;
  currentDeviceOperation.phase = 'result_pending';
  saveDeviceOperation();
  setSetupOperationUi('result_pending');
  showToast(message || 'Операция создана, данные ключа пока не получены. Новый ключ не создаём.');
}

async function replayDeviceOperationResult() {
  if (!currentDeviceOperation || currentDeviceOperation.replayAttempted) {
    keepDeviceResultPending();
    return;
  }

  // Replay keeps the original request_id and target. It is the only permitted
  // second POST after a succeeded status without a saved device payload.
  currentDeviceOperation.replayAttempted = true;
  currentDeviceOperation.phase = 'replaying';
  saveDeviceOperation();
  setSetupOperationUi('replaying');

  try {
    const replayResult = await deviceOperations.createDevice({
      requestId: currentDeviceOperation.requestId,
      target: currentDeviceOperation.target,
      ownerId: currentDeviceOperation.ownerId || 'local-owner',
      replay: true,
    });
    if (replayResult?.status === 'succeeded' && replayResult.device) {
      finishDeviceOperation(replayResult);
      return;
    }
    keepDeviceResultPending(replayResult?.message);
  } catch (error) {
    keepDeviceResultPending(error?.type === 'timeout'
      ? 'Операция создана, но данные ключа пока не получены. Повторный create не запускаем.'
      : 'Нет связи с проверкой результата. Новый ключ не создаём.');
  }
}

async function handleDeviceOperationResult(result) {
  if (!currentDeviceOperation || result?.requestId !== currentDeviceOperation.requestId) return;

  if (result.status === 'accepted' || result.status === 'processing') {
    currentDeviceOperation.phase = result.status;
    saveDeviceOperation();
    setSetupOperationUi(result.status);
    scheduleDeviceStatusCheck();
    return;
  }

  if (result.status === 'succeeded') {
    if (!result.device) {
      await replayDeviceOperationResult();
      return;
    }
    finishDeviceOperation(result);
    return;
  }

  if (result.status === 'conflict') {
    currentDeviceOperation.phase = 'conflict';
    saveDeviceOperation();
    setSetupOperationUi('conflict');
    showToast('Операция уже существует. Проверяем её статус.');
    scheduleDeviceStatusCheck();
    return;
  }

  currentDeviceOperation.phase = result?.code === 'device_limit_reached' ? 'limit' : 'failed';
  saveDeviceOperation();
  setSetupOperationUi(currentDeviceOperation.phase);
  showToast(result?.message || 'Не удалось проверить создание устройства.');
}

async function checkDeviceOperationStatus() {
  if (!currentDeviceOperation || !deviceOperations) return;

  stopDevicePolling();
  try {
    const result = await deviceOperations.getStatus(currentDeviceOperation.requestId);
    if (!result) {
      currentDeviceOperation.phase = 'unknown';
      saveDeviceOperation();
      setSetupOperationUi('unknown');
      showToast('Нет ответа по операции. Проверьте статус позже.');
      return;
    }
    await handleDeviceOperationResult(result);
  } catch (error) {
    currentDeviceOperation.phase = 'unknown';
    saveDeviceOperation();
    setSetupOperationUi('unknown');
    showToast(error?.type === 'timeout'
      ? 'Проверка заняла слишком долго. Повторите проверку статуса.'
      : 'Нет связи. Операция сохранена, можно проверить статус позже.');
  }
}

async function startDeviceOperation(target) {
  if (!deviceOperations) {
    showToast('Локальный mock-контур устройства не загрузился.');
    return;
  }

  if (currentDeviceOperation?.phase === 'limit') {
    showToast('Свободных мест нет. Освободите место в списке устройств.');
    const devicesPage = document.getElementById('page-devices-list');
    if (devicesPage) openOverlay(devicesPage);
    return;
  }

  if (currentDeviceOperation?.phase === 'succeeded') {
    const nextPage = currentDeviceOperation.target === 'other-device'
      ? document.getElementById('page-other-device')
      : document.getElementById('page-app-select');
    if (nextPage) openOverlay(nextPage);
    return;
  }

  if (currentDeviceOperation && ['preparing', 'accepted', 'processing', 'unknown', 'conflict', 'result_pending'].includes(currentDeviceOperation.phase)) {
    checkDeviceOperationStatus();
    return;
  }

  currentDeviceOperation = {
    requestId: createRequestId(),
    target,
    ownerId: 'local-owner',
    phase: 'preparing',
    resultShown: false,
    replayAttempted: false,
  };
  saveDeviceOperation();
  setSetupOperationUi('preparing');

  try {
    const result = await deviceOperations.createDevice({
      requestId: currentDeviceOperation.requestId,
      target,
      ownerId: currentDeviceOperation.ownerId,
    });
    await handleDeviceOperationResult(result);
  } catch (error) {
    currentDeviceOperation.phase = 'unknown';
    saveDeviceOperation();
    setSetupOperationUi('unknown');
    showToast(error?.type === 'timeout'
      ? 'Нет ответа от операции. Не создаём повторно: проверьте статус.'
      : 'Нет связи. Операция сохранена, проверьте статус позже.');
  }
}

if (bentoSetupBtn && pageSetup) {
  bentoSetupBtn.addEventListener('click', () => {
    openOverlay(pageSetup);
  });
}

if (btnSetupBack && pageSetup) {
  btnSetupBack.addEventListener('click', () => {
    closeOverlay(pageSetup);
  });
}

const checkSvgMarkup = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

setupRadioInputs.forEach((radio) => {
  radio.addEventListener('change', () => {
    const isThisDevice = radio.value === 'this-device';
    const optThis = document.getElementById('opt-this-device');
    const optOther = document.getElementById('opt-other-device');
    const markThis = document.getElementById('mark-this-device');
    const markOther = document.getElementById('mark-other-device');

    if (isThisDevice) {
      optThis?.classList.add('active');
      optOther?.classList.remove('active');
      if (markThis) { markThis.classList.add('checked'); markThis.innerHTML = checkSvgMarkup; }
      if (markOther) { markOther.classList.remove('checked'); markOther.innerHTML = ''; }
    } else {
      optOther?.classList.add('active');
      optThis?.classList.remove('active');
      if (markOther) { markOther.classList.add('checked'); markOther.innerHTML = checkSvgMarkup; }
      if (markThis) { markThis.classList.remove('checked'); markThis.innerHTML = ''; }
    }
  });
});

if (setupContinueBtn) {
  setupContinueBtn.addEventListener('click', () => {
    const selectedRadio = document.querySelector('input[name="setup-target"]:checked');
    const isThisDevice = selectedRadio ? selectedRadio.value === 'this-device' : true;
    startDeviceOperation(isThisDevice ? 'this-device' : 'other-device');
  });
}

currentDeviceOperation = readSavedDeviceOperation();
if (currentDeviceOperation && ['preparing', 'accepted', 'processing', 'unknown', 'conflict', 'result_pending'].includes(currentDeviceOperation.phase)) {
  setSetupOperationUi(currentDeviceOperation.phase);
  window.setTimeout(() => checkDeviceOperationStatus(), 0);
} else {
  setSetupOperationUi('idle');
}

// On Another Device Screen (#page-other-device) Logic
const pageOtherDevice = document.getElementById('page-other-device');
const btnOtherDeviceBack = document.getElementById('btn-other-device-back');
const otherDeviceKeyField = document.getElementById('other-device-key-field');
const otherDeviceKeyText = document.getElementById('other-device-key-text');

if (btnOtherDeviceBack && pageOtherDevice) {
  btnOtherDeviceBack.addEventListener('click', () => {
    closeOverlay(pageOtherDevice);
  });
}

if (otherDeviceKeyField && otherDeviceKeyText) {
  otherDeviceKeyField.addEventListener('click', async () => {
    const textToCopy = otherDeviceKeyText.textContent.trim();
    const copied = await copyText(textToCopy);
    showToast(copied ? 'Ключ скопирован' : 'Не удалось скопировать. Нажмите и удерживайте ключ.');
  });
}

// App Selection Screen (#page-app-select) Logic
const pageAppSelect = document.getElementById('page-app-select');
const btnAppSelectBack = document.getElementById('btn-app-select-back');
const appChoiceRadios = document.querySelectorAll('input[name="app-choice"]');
const btnInstallApp = document.getElementById('btn-install-app');
const installAppBtnText = document.getElementById('install-app-btn-text');
const btnAlreadyHaveApp = document.getElementById('btn-already-have-app');

if (btnAppSelectBack && pageAppSelect) {
  btnAppSelectBack.addEventListener('click', () => {
    closeOverlay(pageAppSelect);
  });
}

appChoiceRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    const isKaring = radio.value === 'karing';
    const cardKaring = document.getElementById('app-card-karing');
    const cardIncy = document.getElementById('app-card-incy');
    const btnOpenBotGuide = document.getElementById('btn-open-bot-guide');
    const btnDeviceKaringGuide = document.getElementById('btnDeviceKaringGuide');

    if (isKaring) {
      cardKaring?.classList.add('active');
      cardIncy?.classList.remove('active');
      if (installAppBtnText) installAppBtnText.textContent = 'Установить Karing';
      if (btnOpenBotGuide) btnOpenBotGuide.style.display = 'flex';
      if (btnDeviceKaringGuide) btnDeviceKaringGuide.style.display = 'flex';
    } else {
      cardIncy?.classList.add('active');
      cardKaring?.classList.remove('active');
      if (installAppBtnText) installAppBtnText.textContent = 'Установить INCY';
      if (btnOpenBotGuide) btnOpenBotGuide.style.display = 'none';
      if (btnDeviceKaringGuide) btnDeviceKaringGuide.style.display = 'none';
    }
  });
});

// Helper for detecting user device platform (iOS, Android, macOS, Windows)
function getDevicePlatform() {
  const tgPlatform = (window.Telegram?.WebApp?.platform || '').toLowerCase();
  const ua = navigator.userAgent.toLowerCase();

  if (tgPlatform === 'ios' || /iphone|ipad|ipod/.test(ua)) {
    return 'ios';
  } else if (tgPlatform === 'android' || /android/.test(ua)) {
    return 'android';
  } else if (tgPlatform === 'macos' || /macintosh|mac os x/.test(ua)) {
    return 'macos';
  } else if (/windows|win32|win64/.test(ua)) {
    return 'windows';
  }
  return 'other';
}

const KARING_URLS = {
  ios: 'itms-apps://apps.apple.com/app/karing/id6472431552',
  macos: 'itms-apps://apps.apple.com/app/karing/id6472431552',
  android: 'https://github.com/KaringX/karing/releases/download/v1.2.21.2408/karing_1.2.21.2408_android_arm.apk',
  windows: 'https://github.com/KaringX/karing/releases/tag/v1.2.18.2102',
  other: 'https://apps.apple.com/us/app/karing/id6472431552'
};

const INCY_URLS = {
  ios: 'itms-apps://apps.apple.com/app/incy/id6756943388',
  macos: 'itms-apps://apps.apple.com/app/incy/id6756943388',
  android: 'https://play.google.com/store/apps/details?id=llc.itdev.incy&hl=ru',
  windows: null,
  other: 'https://apps.apple.com/us/app/incy/id6756943388?l=ru'
};

if (btnInstallApp) {
  btnInstallApp.addEventListener('click', () => {
    const selectedRadio = document.querySelector('input[name="app-choice"]:checked');
    const isIncy = selectedRadio && selectedRadio.value === 'incy';
    const appName = isIncy ? 'INCY' : 'Karing';
    const platform = getDevicePlatform();
    const urlMap = isIncy ? INCY_URLS : KARING_URLS;
    const targetUrl = urlMap[platform] !== undefined ? urlMap[platform] : urlMap.other;

    if (!targetUrl) {
      showToast(`Приложение ${appName} пока недоступно для вашей платформы.`);
      return;
    }

    const platformNames = { ios: 'iPhone', android: 'Android', macos: 'Mac', windows: 'Windows' };
    const pName = platformNames[platform] || 'устройства';
    showToast(`Открываем магазин для ${appName} (${pName})...`);
    setTimeout(() => {
      if ((platform === 'ios' || platform === 'macos') && targetUrl.startsWith('itms-apps://')) {
        // Direct native App Store deep link trigger
        window.location.href = targetUrl;
      } else if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(targetUrl);
      } else {
        window.open(targetUrl, '_blank');
      }
    }, 400);
  });
}

if (btnAlreadyHaveApp) {
  btnAlreadyHaveApp.addEventListener('click', () => {
    const pageKeyView = document.getElementById('page-key-view');
    if (pageKeyView) {
      openOverlay(pageKeyView);
    }
  });
}

// Key View Screen (#page-key-view) Logic
const pageKeyView = document.getElementById('page-key-view');
const btnKeyViewBack = document.getElementById('btn-key-view-back');
const keyBoxField = document.getElementById('key-box-field');
const userKeyUrl = document.getElementById('user-key-url');
const btnAddToApp = document.getElementById('btn-add-to-app');
const btnKeyViewFinish = document.getElementById('btn-key-view-finish');
const btnOpenBotGuide = document.getElementById('btn-open-bot-guide');

if (btnKeyViewBack && pageKeyView) {
  btnKeyViewBack.addEventListener('click', () => {
    closeOverlay(pageKeyView);
  });
}

if (btnOpenBotGuide) {
  btnOpenBotGuide.addEventListener('click', () => {
    const selectedRadio = document.querySelector('input[name="app-choice"]:checked');
    const selectedApp = selectedRadio ? selectedRadio.value : 'incy';
    const startParam = selectedApp === 'karing' ? 'help_karing' : 'help_incy';
    const guideUrl = `https://t.me/GhostLinkBot?start=${startParam}`;
    const tgDeepLink = `tg://resolve?domain=GhostLinkBot&start=${startParam}`;
    
    if (window.Telegram && window.Telegram.WebApp && typeof window.Telegram.WebApp.openTelegramLink === 'function') {
      window.Telegram.WebApp.openTelegramLink(guideUrl);
    } else {
      window.location.href = tgDeepLink;
      setTimeout(() => {
        window.open(guideUrl, '_blank');
      }, 300);
    }
  });
}

if (keyBoxField && userKeyUrl) {
  keyBoxField.addEventListener('click', async () => {
    const textToCopy = userKeyUrl.textContent.trim();
    const copied = await copyText(textToCopy);
    showToast(copied ? 'Ключ скопирован' : 'Не удалось скопировать. Нажмите и удерживайте ключ.');
  });
}

if (btnAddToApp && userKeyUrl) {
  btnAddToApp.addEventListener('click', async () => {
    const rawKey = userKeyUrl.textContent.trim();
    const selectedRadio = document.querySelector('input[name="app-choice"]:checked');
    const isIncy = selectedRadio && selectedRadio.value === 'incy';

    // 1. Auto-copy key to clipboard first so user can paste if needed
    const copied = await copyText(rawKey);
    showToast(copied
      ? `Ключ скопирован. Переходим в ${isIncy ? 'INCY' : 'Karing'}...`
      : `Открываем ${isIncy ? 'INCY' : 'Karing'}...`);

    if (isIncy) {
      // Direct vless scheme triggers INCY app protocol
      setTimeout(() => {
        window.location.href = rawKey;
      }, 400);
    } else {
      // Karing deep link scheme
      const encoded = encodeURIComponent(rawKey);
      const karingInstallUrl = `karing://install-config?url=${encoded}`;
      const karingDirectVless = rawKey.replace(/^vless:\/\//i, 'karing://vless/');

      setTimeout(() => {
        window.location.href = karingInstallUrl;
        setTimeout(() => {
          if (document.hidden) return;
          window.location.href = karingDirectVless;
        }, 600);
      }, 400);
    }
  });
}

if (btnKeyViewFinish) {
  btnKeyViewFinish.addEventListener('click', () => {
    returnToHome();
    showToast('Настройка ключа успешно завершена! 🚀');
  });
}

// ----------------------------------------------------
// Platform Detail Setup Modal (#page-device-detail)
// ----------------------------------------------------
const pageDeviceDetail = document.getElementById('page-device-detail');
const btnBackDeviceDetail = document.getElementById('btnBackDeviceDetail');
const deviceDetailHeroIcon = document.getElementById('deviceDetailHeroIcon');
const deviceDetailTitle = document.getElementById('deviceDetailTitle');
const step1Title = document.getElementById('step1Title');
const btnSelectKaring = document.getElementById('btnSelectKaring');
const btnSelectIncy = document.getElementById('btnSelectIncy');
const deviceAppChoice = document.getElementById('deviceAppChoice');
const btnDeviceDownload = document.getElementById('btnDeviceDownload');
const btnDeviceDownloadText = document.getElementById('btnDeviceDownloadText');
const deviceDetailKeyText = document.getElementById('deviceDetailKeyText');
const btnDeviceCopyKey = document.getElementById('btnDeviceCopyKey');

let currentPlatform = 'ios';
let currentAppChoice = 'incy';

const PLATFORM_CONFIG = {
  ios: {
    title: 'Настроить на iOS',
    svg: `<svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`,
    karingUrl: 'itms-apps://apps.apple.com/us/app/karing/id6472431552',
    karingText: 'App Store',
    incyUrl: 'itms-apps://apps.apple.com/app/incy/id6756943388',
    incyText: 'App Store'
  },
  android: {
    title: 'Настроить на Android',
    svg: `<svg width="40" height="40" viewBox="0 0 28 28" fill="currentColor"><path d="M3.99078 1.12012L16.1183 13.1601L19.4433 9.83512L4.74328 1.34762C4.49828 1.20543 4.23578 1.12668 3.99078 1.12012ZM2.97578 1.68012C2.86641 1.8748 2.80078 2.10449 2.80078 2.36262V25.7601C2.80078 25.9482 2.84016 26.1167 2.90578 26.2676L15.3133 13.9476L2.97578 1.68012ZM20.4583 10.4126L16.9058 13.9476L20.4583 17.4651L24.7983 14.9801C25.4152 14.6236 25.5027 14.1707 25.4983 13.9301C25.4917 13.532 25.2402 13.1601 24.8158 12.9326C24.4461 12.7336 21.7008 11.1345 20.4583 10.4126ZM16.1183 14.7351L3.88578 26.8626C4.08922 26.8517 4.31016 26.8079 4.51578 26.6876C4.99484 26.4098 14.6833 20.8076 14.6833 20.8076L19.4608 18.0601L16.1183 14.7351Z"/></svg>`,
    karingUrl: 'https://github.com/KaringX/karing/releases/download/v1.2.21.2408/karing_1.2.21.2408_android_arm.apk',
    karingText: 'Google Play / APK',
    incyUrl: 'https://play.google.com/store/apps/details?id=llc.itdev.incy&hl=ru',
    incyText: 'Google Play'
  },
  macos: {
    title: 'Настроить на macOS',
    svg: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    karingUrl: 'itms-apps://apps.apple.com/us/app/karing/id6472431552',
    karingText: 'App Store',
    incyUrl: 'itms-apps://apps.apple.com/app/incy/id6756943388',
    incyText: 'App Store'
  },
  windows: {
    title: 'Настроить на Windows',
    svg: `<svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5L10.5 4v8H3V5.5zM11.5 4L21 2.5V12H11.5V4zM3 13h7.5v8L3 19.5V13zM11.5 13H21v9.5L11.5 21V13z"/></svg>`,
    karingUrl: 'https://github.com/KaringX/karing/releases/tag/v1.2.18.2102',
    karingText: 'Скачать для Windows',
    incyUrl: null,
    incyText: 'Недоступно'
  },
  tv: {
    title: 'Настроить на TV',
    svg: `<svg width="40" height="40" viewBox="0 0 28 28" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M17.0336 4.25C18.4053 4.25 19.4807 4.24999 20.3451 4.32061C21.2252 4.39252 21.9523 4.54138 22.6104 4.87671C23.6924 5.42798 24.572 6.30762 25.1233 7.38955C25.4586 8.04769 25.6075 8.77479 25.6794 9.65494C25.75 10.5192 25.75 11.5947 25.75 12.9663V13.0336C25.75 14.4052 25.75 15.4808 25.6794 16.3451C25.6075 17.2252 25.4586 17.9523 25.1233 18.6104C24.572 19.6924 23.6924 20.572 22.6104 21.1233C21.9523 21.4586 21.2252 21.6075 20.3451 21.6794C19.4808 21.75 18.4053 21.75 17.0337 21.75H14.75V23.584C15.3744 23.6276 15.9959 23.7259 16.6073 23.8787L18.1819 24.2724C18.5837 24.3729 18.8281 24.7801 18.7276 25.1819C18.6271 25.5837 18.2199 25.8281 17.8181 25.7276L16.2435 25.3339C15.507 25.1498 14.7535 25.0578 14 25.0578C13.2465 25.0578 12.493 25.1498 11.7565 25.3339L10.1819 25.7276C9.78006 25.8281 9.37285 25.5837 9.27239 25.1819C9.17193 24.7801 9.41625 24.3729 9.8181 24.2724L11.3927 23.8787C12.0041 23.7259 12.6256 23.6276 13.25 23.584V21.75H10.9664C9.59476 21.75 8.51924 21.75 7.65494 21.6794C6.77479 21.6075 6.04769 21.4586 5.38955 21.1233C4.30762 20.572 3.42798 19.6924 2.87671 18.6104C2.54138 17.9523 2.39252 17.2252 2.32061 16.3451C2.24999 15.4807 2.25 14.4053 2.25 13.0336V12.9664C2.25 11.5947 2.24999 10.5193 2.32061 9.65494C2.39252 8.7748 2.54138 8.04769 2.87671 7.38955C3.42798 6.30762 4.30762 5.42798 5.38955 4.87671C6.04769 4.54138 6.77479 4.39252 7.65494 4.32061C8.51929 4.24999 9.59472 4.25 10.9664 4.25H17.0336ZM13.25 18C13.25 18.4142 13.5858 18.75 14 18.75L20 18.75C20.4142 18.75 20.75 18.4142 20.75 18C20.75 17.5858 20.4142 17.25 20 17.25L14 17.25C13.5858 17.25 13.25 17.5858 13.25 18ZM10 18C10 18.5523 9.55229 19 9 19C8.44772 19 8 18.5523 8 18C8 17.4477 8.44772 17 9 17C9.55229 17 10 17.4477 10 18Z"/></svg>`,
    karingUrl: 'https://github.com/KaringX/karing/releases/tag/v1.2.18.2102',
    karingText: 'Android TV / APK',
    incyUrl: null,
    incyText: 'В разработке',
    karingOnly: true
  },
  linux: {
    title: 'Настроить на Linux',
    svg: `<img src="./assets/icons/Linux.svg" style="width: 40px; height: 40px; filter: brightness(0) invert(1);" alt="Linux" />`,
    karingUrl: 'https://github.com/KaringX/karing/releases/tag/v1.2.18.2102',
    karingText: 'Скачать Client / CLI',
    incyUrl: null,
    incyText: 'В разработке',
    karingOnly: true
  }
};

const btnDeviceKaringGuide = document.getElementById('btnDeviceKaringGuide');

if (btnDeviceKaringGuide) {
  btnDeviceKaringGuide.addEventListener('click', () => {
    const startParam = currentAppChoice === 'karing' ? 'help_karing' : 'help_incy';
    const guideUrl = `https://t.me/GhostLinkBot?start=${startParam}`;
    const tgDeepLink = `tg://resolve?domain=GhostLinkBot&start=${startParam}`;
    if (window.Telegram && window.Telegram.WebApp && typeof window.Telegram.WebApp.openTelegramLink === 'function') {
      window.Telegram.WebApp.openTelegramLink(guideUrl);
    } else {
      window.location.href = tgDeepLink;
      setTimeout(() => {
        window.open(guideUrl, '_blank');
      }, 300);
    }
  });
}

function updateKaringGuideVisibility() {
  if (!btnDeviceKaringGuide) return;
  if (currentAppChoice === 'karing') {
    btnDeviceKaringGuide.style.display = 'flex';
  } else {
    btnDeviceKaringGuide.style.display = 'none';
  }
}

function updateDownloadButton() {
  const config = PLATFORM_CONFIG[currentPlatform];
  if (!config) return;

  if (currentAppChoice === 'karing') {
    btnDeviceDownload.href = config.karingUrl || '#';
    btnDeviceDownloadText.textContent = config.karingText || 'Скачать Karing';
    btnDeviceDownload.style.opacity = '1';
    btnDeviceDownload.style.pointerEvents = 'auto';
  } else {
    if (config.incyUrl) {
      btnDeviceDownload.href = config.incyUrl;
      btnDeviceDownloadText.textContent = config.incyText || 'Скачать INCY';
      btnDeviceDownload.style.opacity = '1';
      btnDeviceDownload.style.pointerEvents = 'auto';
    } else {
      btnDeviceDownload.href = '#';
      btnDeviceDownloadText.textContent = 'Скачать INCY';
      btnDeviceDownload.style.opacity = '0.5';
      btnDeviceDownload.style.pointerEvents = 'none';
    }
  }
}

// Open platform detail modal when platform card is clicked
document.querySelectorAll('.platform-card').forEach(card => {
  card.addEventListener('click', () => {
    const platform = card.dataset.platform || 'ios';
    currentPlatform = platform;
    const config = PLATFORM_CONFIG[platform];

    if (config) {
      if (deviceDetailHeroIcon) deviceDetailHeroIcon.innerHTML = config.svg;
      if (deviceDetailTitle) deviceDetailTitle.textContent = config.title;

      if (config.karingOnly || platform === 'windows') {
        // Linux and Windows only support Karing, so do not offer a dead INCY choice.
        if (deviceAppChoice) deviceAppChoice.style.display = 'none';
        if (btnSelectIncy) btnSelectIncy.style.display = 'none';
        currentAppChoice = 'karing';
        if (btnSelectKaring) btnSelectKaring.classList.add('active');
        if (btnSelectIncy) btnSelectIncy.classList.remove('active');
      } else {
        // Platforms that offer both supported apps keep the selector visible.
        if (deviceAppChoice) deviceAppChoice.style.display = '';
        if (btnSelectIncy) btnSelectIncy.style.display = '';
        currentAppChoice = config.incyUrl ? 'incy' : 'karing';
        if (currentAppChoice === 'incy') {
          if (btnSelectIncy) btnSelectIncy.classList.add('active');
          if (btnSelectKaring) btnSelectKaring.classList.remove('active');
        } else {
          if (btnSelectKaring) btnSelectKaring.classList.add('active');
          if (btnSelectIncy) btnSelectIncy.classList.remove('active');
        }
      }

      if (step1Title) step1Title.textContent = `Скачайте приложение ${currentAppChoice === 'karing' ? 'Karing' : 'INCY'}`;
      updateDownloadButton();
      updateKaringGuideVisibility();
    }

    openOverlay(pageDeviceDetail);
  });
});

if (btnBackDeviceDetail && pageDeviceDetail) {
  btnBackDeviceDetail.addEventListener('click', () => {
    closeOverlay(pageDeviceDetail);
  });
}

// App Selector Tabs inside Device Detail Modal
if (btnSelectKaring && btnSelectIncy) {
  btnSelectKaring.addEventListener('click', () => {
    currentAppChoice = 'karing';
    btnSelectKaring.classList.add('active');
    btnSelectIncy.classList.remove('active');
    if (step1Title) step1Title.textContent = 'Скачайте приложение Karing';
    updateDownloadButton();
    updateKaringGuideVisibility();
  });

  btnSelectIncy.addEventListener('click', () => {
    currentAppChoice = 'incy';
    btnSelectIncy.classList.add('active');
    btnSelectKaring.classList.remove('active');
    if (step1Title) step1Title.textContent = 'Скачайте приложение INCY';
    updateDownloadButton();
    updateKaringGuideVisibility();
  });
}

// Copy key button inside modal
if (btnDeviceCopyKey) {
  btnDeviceCopyKey.addEventListener('click', async () => {
    const rawKeyText = document.getElementById('user-key-url')?.textContent.trim() || 'vless://ghostlink-key-8fa492b...#GhostLink-1';
    const copied = await copyText(rawKeyText);
    showToast(copied ? 'Ключ скопирован' : 'Не удалось скопировать. Нажмите и удерживайте ключ.');
  });
}

if (deviceDetailKeyText) {
  deviceDetailKeyText.addEventListener('click', async () => {
    const rawKeyText = document.getElementById('user-key-url')?.textContent.trim() || 'vless://ghostlink-key-8fa492b...#GhostLink-1';
    const copied = await copyText(rawKeyText);
    showToast(copied ? 'Ключ скопирован' : 'Не удалось скопировать. Нажмите и удерживайте ключ.');
  });
}

// Download action button click handler
if (btnDeviceDownload) {
  btnDeviceDownload.addEventListener('click', (e) => {
    const targetUrl = btnDeviceDownload.getAttribute('href');
    if (!targetUrl || targetUrl === '#') {
      e.preventDefault();
      return;
    }
    if (targetUrl.startsWith('itms-apps://')) {
      e.preventDefault();
      window.location.href = targetUrl;
    }
  });
}


};
})();
