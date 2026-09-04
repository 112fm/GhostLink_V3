(() => {
const GhostLinkV3 = window.GhostLinkV3 = window.GhostLinkV3 || {};

GhostLinkV3.initDevicesModule = function initDevicesModule(dependencies = {}) {
  const { showToast, copyText, openOverlay, closeOverlay, returnToHome, profileSubscription } = dependencies;

  // Local-only operation adapter. The future API must preserve this request_id contract.
  const deviceOperations = dependencies.deviceOperations;
  // Mutations are deliberately separate from creation: future API calls need
  // independent request_id tracking and must never retry a destructive POST.
  const deviceMutations = dependencies.deviceMutations;
  // Local-only list adapter. It mirrors the future server snapshot contract.
  const deviceList = dependencies.deviceList;
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
let selectedSetupDeviceId = null;
let selectedSetupDevice = null;
let setupFlowMode = 'this-device';
let pendingNewDevice = null;

function getDeviceEmoji(platform) {
  return { phone: '📱', laptop: '💻', tv: '📺' }[platform] || '📱';
}

function getDevicePlatformSvg(device) {
  const p = (device?.platform || '').toLowerCase();
  const n = (device?.name || '').toLowerCase();

  // Apple / iOS
  if (p.includes('ios') || p.includes('apple') || p.includes('iphone') || p.includes('ipad') || n.includes('iphone') || n.includes('ipad') || n.includes('apple')) {
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>';
  }
  // macOS / Mac
  if (p.includes('macos') || p.includes('mac') || n.includes('mac') || n.includes('macbook')) {
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
  }
  // Windows
  if (p.includes('win') || n.includes('win') || n.includes('windows') || n.includes('пк')) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5L10.5 4v8H3V5.5zM11.5 4L21 2.5V12H11.5V4zM3 13h7.5v8L3 19.5V13zM11.5 13H21v9.5L11.5 21V13z"/></svg>';
  }
  // Android
  if (p.includes('android') || n.includes('android') || n.includes('samsung') || n.includes('xiaomi') || n.includes('pixel') || n.includes('redmi')) {
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-4.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 2.23 12.95 2 12 2c-.96 0-1.86.23-2.66.63L7.85 1.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 4.26 6 5.92 6 7.8h12c0-1.88-.97-3.54-2.47-4.64zM9 5.5c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75zm6 0c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75z"/></svg>';
  }
  // TV
  if (p.includes('tv') || n.includes('tv')) {
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>';
  }
  // Linux
  if (p.includes('linux') || n.includes('linux') || n.includes('ubuntu')) {
    return '<img src="./assets/icons/Linux.svg" style="width: 20px; height: 20px; filter: brightness(0) invert(1);" alt="Linux" />';
  }
  // Laptop fallback
  if (p === 'laptop' || n.includes('laptop') || n.includes('ноутбук')) {
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
  }
  // Phone / Default device
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>';
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
    emoji.className = 'device-platform-icon device-badge-emoji';
    emoji.innerHTML = getDevicePlatformSvg(device);
    const info = document.createElement('div');
    info.className = 'device-apple-info';
    const name = document.createElement('span');
    name.className = 'device-apple-name';
    name.textContent = device.name;
    const meta = document.createElement('span');
    meta.className = 'device-apple-meta';
    meta.textContent = device.app && device.app !== 'Не определено' ? `Подключено через ${device.app}` : 'Готово к подключению';
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
    activityText.textContent = (device.lastActive && device.lastActive !== 'Нет данных') ? device.lastActive : 'Активно';
    activity.append(dot, activityText);
    stats.append(activity);
    if (device.traffic && device.traffic !== 'Нет данных') {
      const traffic = document.createElement('span');
      traffic.className = 'device-traffic-chip';
      traffic.textContent = device.traffic;
      stats.append(traffic);
    }
    right.append(stats);

    const actions = document.createElement('div');
    actions.className = 'device-card-actions';
    const isBusy = pendingDeviceMutations.has(device.id);
    
    // Подключить
    const btnConnect = document.createElement('button');
    btnConnect.type = 'button';
    btnConnect.className = 'device-card-action device-card-action--connect';
    btnConnect.textContent = isBusy ? 'Загрузка...' : 'Подключить';
    btnConnect.disabled = isBusy;
    btnConnect.addEventListener('click', () => selectDeviceForSetup(device));
    
    // Удалить
    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'device-card-action device-card-action--remove';
    btnRemove.setAttribute('aria-label', 'Удалить устройство');
    btnRemove.setAttribute('title', 'Удалить устройство');
    btnRemove.innerHTML = isBusy
      ? '...'
      : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
    btnRemove.disabled = isBusy;
    btnRemove.addEventListener('click', () => confirmDeviceDeletion(device));
    
    actions.append(btnConnect, btnRemove);
    card.append(left, right, actions);
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

  const slotFill = document.getElementById('devices-slot-bar-fill');
  if (slotFill && snapshot.deviceLimit > 0) {
    const pct = Math.min(100, Math.max(0, Math.round((snapshot.usedSlots / snapshot.deviceLimit) * 100)));
    slotFill.style.width = `${pct}%`;
  }

  if (settingsDevicesSubtitle) settingsDevicesSubtitle.textContent = `Подключено: ${snapshot.usedSlots} из ${snapshot.deviceLimit}`;
  
  // Update Home Counter
  const homeCounter = document.getElementById('subscriptionDeviceCount');
  if (homeCounter && snapshot.deviceLimit > 0) {
    const used = snapshot.usedSlots;
    const word = (used % 10 === 1 && used % 100 !== 11) ? 'устройство' : ([2, 3, 4].includes(used % 10) && ![12, 13, 14].includes(used % 100)) ? 'устройства' : 'устройств';
    homeCounter.textContent = `${used} ${word} · лимит ${snapshot.deviceLimit}`;
  }

  devicesEmptyState?.classList.toggle('hidden', !isEmpty);
  devicesUnavailableState?.classList.add('hidden');
  if (btnDevicesAdd) {
    btnDevicesAdd.disabled = isAtLimit;
    btnDevicesAdd.textContent = isAtLimit ? 'Лимит устройств достигнут' : 'Добавить устройство';
  }
  setDevicesListStatus(isAtLimit
    ? 'Все слоты по тарифу заняты.'
    : isEmpty ? 'Список устройств пуст. Добавьте первое устройство.' : 'Список устройств обновлён.');
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
  const mutationType = result?.type || 'remove';
  const copy = getMutationCopy(mutationType);
  pendingDeviceMutations.delete(deviceId);
  saveDeviceMutations();

  if (mutationType === 'rotate' && result?.device?.id) {
    if (selectedSetupDeviceId === deviceId) {
      selectedSetupDeviceId = result.device.id;
      selectedSetupDevice = { ...result.device };
      updateDisplayedSubscriptionUrls(currentSelectedApp);
    }
  } else if (mutationType === 'remove') {
    if (selectedSetupDeviceId === deviceId) {
      selectedSetupDeviceId = null;
      selectedSetupDevice = null;
      updateDisplayedSubscriptionUrls(currentSelectedApp);
    }
  }

  showToast(copy.success);

  const applied = deviceList?.applyMutation?.(result);
  if (applied) {
    const optimisticSnapshot = applyMutationToSnapshot(lastConfirmedDeviceList, result);
    if (optimisticSnapshot) renderDeviceList(optimisticSnapshot);
  }

  loadDeviceList().then((snapshot) => {
    if (snapshot) {
      setDevicesListStatus(`${copy.success} Список обновлён.`);
    } else {
      setDevicesListStatus(copy.success);
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

function confirmDeviceDeletion(device) {
  const modal = document.getElementById('modalConfirmDeleteDevice');
  const modalText = document.getElementById('deleteDeviceModalText');
  const btnSubmit = document.getElementById('btnConfirmDeleteSubmit');
  const btnCancel = document.getElementById('btnConfirmDeleteCancel');
  const btnClose = document.getElementById('btnConfirmDeleteClose');
  
  if (!modal || !modalText) return;
  
  modalText.textContent = `Удалить устройство ${device.name}? Доступ на этом девайсе будет остановлен, слот освободится.`;
  modal.classList.remove('hidden');
  
  const cleanup = () => {
    modal.classList.add('hidden');
    btnSubmit.onclick = null;
    btnCancel.onclick = null;
    btnClose.onclick = null;
  };
  
  btnCancel.onclick = cleanup;
  btnClose.onclick = cleanup;
  
  btnSubmit.onclick = async () => {
    cleanup();
    
    if (deviceMutations) {
      startDeviceMutation(device, 'remove');
    }
  };
}

async function startDeviceMutation(device, type) {
  if (!deviceMutations || !device?.id) {
    setDevicesListStatus('Сервис операций с устройствами недоступен.', 'error');
    return;
  }
  if (pendingDeviceMutations.has(device.id)) {
    const operation = pendingDeviceMutations.get(device.id);
    checkDeviceMutationStatus(device.id, operation.requestId);
    return;
  }
  // Let the new confirm modal handle remove
  if (type !== 'remove' && typeof window.confirm === 'function') {
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
      showToast('Лимит устройств исчерпан. Удалите неиспользуемое устройство или увеличьте лимит');
      return;
    }
    
    // Открываем окно ввода имени
    const modal = document.getElementById('modalAddDeviceName');
    const input = document.getElementById('addDeviceNameInput');
    const btnSubmit = document.getElementById('btnAddDeviceSubmit');
    const btnClose = document.getElementById('btnAddDeviceClose');
    if (!modal) return;
    
    input.value = '';
    modal.classList.remove('hidden');
    input.focus?.();
    
    const cleanup = () => {
      modal.classList.add('hidden');
      btnSubmit.onclick = null;
      btnClose.onclick = null;
    };
    
    btnClose.onclick = cleanup;
    btnSubmit.onclick = () => {
      const name = input.value.trim() || 'Новое устройство';
      cleanup();
      pendingNewDevice = { name, platform: 'unknown', target: 'other-device' };
      selectedSetupDeviceId = null;
      selectedSetupDevice = null;
      setupFlowMode = 'new-other-device';
      autoSelectDefaultAppForCurrentPlatform('windows');
      openOverlay(pageAppSelect);
    };
  });
}

function createRequestId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error('Криптографический генератор request_id недоступен.');
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

function finishDeviceOperation(result) {
  if (!result?.device?.id) {
    currentDeviceOperation.phase = 'failed';
    saveDeviceOperation();
    setSetupOperationUi('failed');
    showToast('Сервер не подтвердил созданное устройство.');
    return;
  }
  stopDevicePolling();
  selectedSetupDeviceId = result.device.id;
  selectedSetupDevice = { ...result.device };
  currentDeviceOperation = {
    ...currentDeviceOperation,
    phase: 'succeeded',
    resultShown: currentDeviceOperation?.resultShown || false,
  };
  if (!pageDevicesList?.classList.contains('hidden')) loadDeviceList();
  setSetupOperationUi('succeeded');

  if (!currentDeviceOperation.resultShown) {
    currentDeviceOperation.resultShown = true;
    saveDeviceOperation();
    showToast('Устройство создано. Выберите приложение для настройки.');
    const nextPage = currentDeviceOperation.target === 'other-device'
      ? document.getElementById('page-other-device')
      : document.getElementById('page-app-select');
    if (nextPage) {
      if (nextPage.id === 'page-other-device') {
        openOtherDevicePicker();
      } else {
        autoSelectDefaultAppForCurrentPlatform();
        openOverlay(nextPage);
      }
    }
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
    showToast('Операции устройств сейчас недоступны.');
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
    if (nextPage) {
      if (nextPage.id === 'page-other-device') {
        openOtherDevicePicker();
      } else {
        autoSelectDefaultAppForCurrentPlatform();
        openOverlay(nextPage);
      }
    }
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
    if (isThisDevice) {
      selectedSetupDeviceId = null;
      selectedSetupDevice = null;
      setupFlowMode = 'this-device';
      autoSelectDefaultAppForCurrentPlatform();
      openOverlay(pageAppSelect);
      return;
    }
    openOtherDevicePicker();
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
const otherDevicePickerList = document.getElementById('other-device-picker-list');
const otherDevicePickerStatus = document.getElementById('other-device-picker-status');

function setOtherDevicePickerStatus(message, tone = 'neutral') {
  if (!otherDevicePickerStatus) return;
  otherDevicePickerStatus.textContent = message;
  otherDevicePickerStatus.dataset.tone = tone;
}

function renderOtherDevicePicker(devices) {
  if (!otherDevicePickerList) return;
  otherDevicePickerList.replaceChildren();

  if (!Array.isArray(devices) || devices.length === 0) {
    setOtherDevicePickerStatus('В списке пока нет устройств. Создание новой записи появится после подключения API.', 'neutral');
    return;
  }

  devices.forEach((device) => {
    if (!device?.id) return;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'other-device-picker-card';
    card.dataset.deviceUuid = device.id;

    const icon = document.createElement('span');
    icon.className = 'other-device-picker-icon';
    icon.innerHTML = getDevicePlatformSvg(device);
    const copy = document.createElement('span');
    copy.className = 'other-device-picker-copy';
    const name = document.createElement('strong');
    name.textContent = device.name || 'Устройство';
    const meta = document.createElement('small');
    meta.textContent = device.app || 'Приложение не выбрано';
    copy.append(name, meta);
    const arrow = document.createElement('span');
    arrow.className = 'other-device-picker-arrow';
    arrow.textContent = '›';
    card.append(icon, copy, arrow);
    card.addEventListener('click', () => selectDeviceForSetup(device));
    otherDevicePickerList.append(card);
  });
  setOtherDevicePickerStatus('Выберите устройство для настройки приложения.');
}

function selectDeviceForSetup(device) {
  if (!device?.id) return;
  const matched = lastConfirmedDeviceList?.devices?.find((d) => d.id === device.id);
  selectedSetupDeviceId = device.id;
  selectedSetupDevice = matched ? { ...matched, ...device } : { ...device };
  autoSelectDefaultAppForCurrentPlatform();
  openOverlay(pageAppSelect);
}

async function openOtherDevicePicker() {
  if (!pageOtherDevice) return;
  openOverlay(pageOtherDevice);
  otherDevicePickerList?.replaceChildren();
  setOtherDevicePickerStatus('Получаем список устройств…');

  const btnOtherDeviceAddNew = document.getElementById('btnOtherDeviceAddNew');
  if (btnOtherDeviceAddNew && !btnOtherDeviceAddNew._hasAddNewListener) {
    btnOtherDeviceAddNew._hasAddNewListener = true;
    btnOtherDeviceAddNew.addEventListener('click', () => {
      if (lastConfirmedDeviceList && lastConfirmedDeviceList.freeSlots <= 0) {
        showToast('Все слоты по тарифу заняты. Освободите слот или увеличьте тариф.');
        return;
      }
      const modal = document.getElementById('modalAddDeviceName');
      const input = document.getElementById('addDeviceNameInput');
      const btnSubmit = document.getElementById('btnAddDeviceSubmit');
      const btnClose = document.getElementById('btnAddDeviceClose');
      if (!modal) return;

      input.value = '';
      modal.classList.remove('hidden');
      input.focus?.();

      const cleanup = () => {
        modal.classList.add('hidden');
        btnSubmit.onclick = null;
        btnClose.onclick = null;
      };

      btnClose.onclick = cleanup;
      btnSubmit.onclick = () => {
        const name = input.value.trim() || 'Новое устройство';
        cleanup();
        pendingNewDevice = { name, platform: 'unknown', target: 'other-device' };
        selectedSetupDeviceId = null;
        selectedSetupDevice = null;
        setupFlowMode = 'new-other-device';
        autoSelectDefaultAppForCurrentPlatform('windows');
        openOverlay(pageAppSelect);
      };
    });
  }

  try {
    const snapshot = await deviceList?.fetchList?.();
    if (!snapshot) throw new Error('Device list is unavailable');
    lastConfirmedDeviceList = snapshot;
    renderOtherDevicePicker(snapshot.devices);
  } catch (error) {
    setOtherDevicePickerStatus(error?.type === 'timeout'
      ? 'Список устройств отвечает слишком долго. Попробуйте ещё раз.'
      : 'Не удалось получить список устройств. Проверьте подключение и повторите.', 'error');
  }
}

function isValidSubToken(token) {
  if (typeof token !== 'string') return false;
  const trimmed = token.trim();
  if (!trimmed) return false;
  // Strictly reject 64-char hex session authorization bearer hashes
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return false;
  return true;
}

function extractSubTokenFromUrl(url) {
  if (typeof url !== 'string') return '';
  const match = url.match(/\/sub\/([A-Za-z0-9_-]+)/);
  if (match && isValidSubToken(match[1])) {
    return match[1].trim();
  }
  return '';
}

function getCurrentUserToken() {
  const directSubToken = profileSubscription?.getSubToken?.();
  if (isValidSubToken(directSubToken)) return directSubToken.trim();

  const cached = profileSubscription?.getCachedProfile?.();
  if (isValidSubToken(cached?.user?.sub_token)) return cached.user.sub_token.trim();
  if (isValidSubToken(cached?.sub_token)) return cached.sub_token.trim();
  if (isValidSubToken(cached?.profile?.sub_token)) return cached.profile.sub_token.trim();
  if (isValidSubToken(cached?.subscription?.sub_token)) return cached.subscription.sub_token.trim();
  if (isValidSubToken(cached?.user?.subscription_token)) return cached.user.subscription_token.trim();

  const snapshot = profileSubscription?.getSnapshot?.();
  if (isValidSubToken(snapshot?.user?.sub_token)) return snapshot.user.sub_token.trim();
  if (isValidSubToken(snapshot?.sub_token)) return snapshot.sub_token.trim();
  if (isValidSubToken(snapshot?.profile?.sub_token)) return snapshot.profile.sub_token.trim();
  if (isValidSubToken(snapshot?.subscription?.sub_token)) return snapshot.subscription.sub_token.trim();
  if (isValidSubToken(snapshot?.user?.subscription_token)) return snapshot.user.subscription_token.trim();

  const urlCandidates = [
    cached?.subscription_url,
    cached?.subscription?.subscription_url,
    cached?.user?.subscription_url,
    cached?.subscription_link,
    cached?.user?.subscription_link,
    snapshot?.subscription_url,
    snapshot?.subscription?.subscription_url,
    snapshot?.user?.subscription_url,
    snapshot?.subscription_link,
    snapshot?.user?.subscription_link,
  ];
  for (const candidate of urlCandidates) {
    const extracted = extractSubTokenFromUrl(candidate);
    if (extracted) return extracted;
  }

  const directToken = profileSubscription?.getToken?.();
  if (isValidSubToken(directToken)) return directToken.trim();

  if (isValidSubToken(cached?.user?.token)) return cached.user.token.trim();
  if (isValidSubToken(cached?.token)) return cached.token.trim();
  if (isValidSubToken(snapshot?.user?.token)) return snapshot.user.token.trim();
  if (isValidSubToken(snapshot?.token)) return snapshot.token.trim();

  return '';
}

function isSubscriptionReady(app = currentSelectedApp || 'karing') {
  return Boolean(getSubscriptionUrl(app));
}

function getAllowedSubscriptionOrigins() {
  const configured = profileSubscription?.getApiBase?.() || window.GhostLinkV3?.apiBase || 'https://api.112prd.ru';
  const origins = new Set([String(configured).replace(/\/+$/, '')]);
  try {
    const parsed = new URL(configured);
    origins.add(parsed.origin);
    if (parsed.port === '') origins.add(`${parsed.origin}:2053`);
  } catch (_) {}
  return origins;
}

function isSafeSubscriptionUrl(candidate, expectedOrigins = getAllowedSubscriptionOrigins()) {
  if (typeof candidate !== 'string') return false;
  const value = candidate.trim();
  if (!value || /mock|placeholder|undefined|null|••••|session|init_data|pwa_token|access_token/i.test(value)) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || !expectedOrigins.has(parsed.origin)) return false;
    if (/^\/api(?:\/|$)/i.test(parsed.pathname)) return false;
    if (!/^\/(?:sub|s)(?:\/|$)/i.test(parsed.pathname)) return false;
    for (const key of parsed.searchParams.keys()) {
      if (/token|auth|session|init/i.test(key)) return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

function getProvidedSubscriptionUrl(...candidates) {
  const expectedOrigins = getAllowedSubscriptionOrigins();
  for (const candidate of candidates) {
    if (isSafeSubscriptionUrl(candidate, expectedOrigins)) return candidate.trim();
  }
  return '';
}

function getSubscriptionUrl(app = 'karing') {
  let targetDevice = selectedSetupDevice;
  if (!targetDevice && lastConfirmedDeviceList?.devices) {
    targetDevice = lastConfirmedDeviceList.devices.find((d) => d.isCurrent);
  }

  if (targetDevice) {
    if (app === 'incy') {
      return getProvidedSubscriptionUrl(targetDevice.url_incy, targetDevice.subscription_url_incy);
    }
    return getProvidedSubscriptionUrl(targetDevice.url, targetDevice.subscription_url);
  }

  return '';
}

let currentSelectedApp = 'incy';

function setBtnAddToAppText(btn, text) {
  if (!btn) return;
  const span = btn.querySelector('span');
  if (span) {
    span.textContent = text;
  } else {
    btn.textContent = text;
  }
}

function updateDisplayedSubscriptionUrls(app = currentSelectedApp || 'karing') {
  currentSelectedApp = app;
  const incyUrl = getSubscriptionUrl('incy');
  const karingUrl = getSubscriptionUrl('karing');
  const currentUrl = app === 'incy' ? incyUrl : karingUrl;
  const appName = app === 'incy' ? 'INCY' : 'Karing';

  if (userKeyUrl) userKeyUrl.textContent = currentUrl || `Ссылка для ${appName} недоступна`;
  if (deviceDetailKeyText) deviceDetailKeyText.textContent = currentUrl || `Ссылка для ${appName} недоступна`;

  if (btnAddToApp) {
    if (!currentUrl) {
      btnAddToApp.disabled = true;
      setBtnAddToAppText(btnAddToApp, `Ссылка для ${appName} недоступна`);
    } else {
      btnAddToApp.disabled = false;
      setBtnAddToAppText(btnAddToApp, `Добавить в ${app === 'incy' ? 'INCY' : 'Karing'}`);
    }
  }
}

if (typeof profileSubscription?.subscribe === 'function') {
  try {
    profileSubscription.subscribe(() => {
      updateDisplayedSubscriptionUrls(currentSelectedApp);
    });
  } catch (_) {}
}

if (btnOtherDeviceBack && pageOtherDevice) {
  btnOtherDeviceBack.addEventListener('click', () => {
    closeOverlay(pageOtherDevice);
  });
}

// App Selection Screen (#page-app-select) Logic
const pageAppSelect = document.getElementById('page-app-select');
const btnAppSelectBack = document.getElementById('btn-app-select-back');
const appChoiceRadios = document.querySelectorAll('input[name="app-choice"]');
const btnInstallApp = document.getElementById('btn-install-app');
const installAppBtnText = document.getElementById('install-app-btn-text');
const btnAlreadyHaveApp = document.getElementById('btn-already-have-app');
const cardIncy = document.getElementById('app-card-incy');
const cardKaring = document.getElementById('app-card-karing');

if (btnAppSelectBack && pageAppSelect) {
  btnAppSelectBack.addEventListener('click', () => {
    closeOverlay(pageAppSelect);
  });
}

function selectAppChoice(app) {
  currentSelectedApp = app;
  const isKaring = app === 'karing';
  const radioKaring = document.querySelector('input[name="app-choice"][value="karing"]');
  const radioIncy = document.querySelector('input[name="app-choice"][value="incy"]');
  const cardKaringEl = document.getElementById('app-card-karing');
  const cardIncyEl = document.getElementById('app-card-incy');
  const btnOpenBotGuideEl = document.getElementById('btn-open-bot-guide');
  const btnDeviceKaringGuideEl = document.getElementById('btnDeviceKaringGuide');

  if (isKaring) {
    if (radioKaring) radioKaring.checked = true;
    if (radioIncy) radioIncy.checked = false;
    cardKaringEl?.classList.add('active');
    cardIncyEl?.classList.remove('active');
    if (installAppBtnText) installAppBtnText.textContent = 'Установить Karing';
    if (btnOpenBotGuideEl) btnOpenBotGuideEl.style.display = 'flex';
    if (btnDeviceKaringGuideEl) btnDeviceKaringGuideEl.style.display = 'flex';
  } else {
    if (radioIncy) radioIncy.checked = true;
    if (radioKaring) radioKaring.checked = false;
    cardIncyEl?.classList.add('active');
    cardKaringEl?.classList.remove('active');
    if (installAppBtnText) installAppBtnText.textContent = 'Установить INCY';
    if (btnOpenBotGuideEl) btnOpenBotGuideEl.style.display = 'none';
    if (btnDeviceKaringGuideEl) btnDeviceKaringGuideEl.style.display = 'none';
  }

  updateDisplayedSubscriptionUrls(app);
}

function autoSelectDefaultAppForCurrentPlatform(platform = getDevicePlatform()) {
  const karingOnlyPlatforms = ['windows', 'linux', 'tv'];
  const defaultApp = karingOnlyPlatforms.includes(platform) ? 'karing' : 'incy';
  selectAppChoice(defaultApp);
  return defaultApp;
}

cardIncy?.addEventListener('click', () => selectAppChoice('incy'));
cardKaring?.addEventListener('click', () => selectAppChoice('karing'));

appChoiceRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    selectAppChoice(radio.value);
  });
});

// Helper for detecting user device platform (iOS, Android, macOS, Windows, Linux, TV)
function getDevicePlatform() {
  const tgPlatform = (window.Telegram?.WebApp?.platform || '').toLowerCase();
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '').toLowerCase();

  if (tgPlatform === 'ios' || /iphone|ipad|ipod/.test(ua)) {
    return 'ios';
  } else if (tgPlatform === 'android' || /android/.test(ua)) {
    return 'android';
  } else if (tgPlatform === 'macos' || /macintosh|mac os x/.test(ua)) {
    return 'macos';
  } else if (tgPlatform === 'tdesktop' || tgPlatform === 'weba' || tgPlatform === 'webk' || tgPlatform === 'web') {
    if (/windows|win32|win64/.test(ua)) return 'windows';
    if (/linux/.test(ua)) return 'linux';
    if (/macintosh|mac os x/.test(ua)) return 'macos';
    return 'windows';
  } else if (/windows|win32|win64/.test(ua)) {
    return 'windows';
  } else if (/smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast.tv/.test(ua)) {
    return 'tv';
  } else if (/linux/.test(ua)) {
    return 'linux';
  }
  return 'other';
}

const KARING_URLS = {
  ios: 'https://apps.apple.com/app/karing/id6472431552',
  macos: 'https://apps.apple.com/app/karing/id6472431552',
  android: 'https://github.com/KaringX/karing/releases/download/v1.2.21.2408/karing_1.2.21.2408_android_arm.apk',
  windows: 'https://github.com/KaringX/karing/releases/tag/v1.2.18.2102',
  other: 'https://apps.apple.com/app/karing/id6472431552'
};

const INCY_URLS = {
  ios: 'https://apps.apple.com/app/incy/id6756943388',
  macos: 'https://apps.apple.com/app/incy/id6756943388',
  android: 'https://play.google.com/store/apps/details?id=llc.itdev.incy',
  windows: null,
  other: 'https://apps.apple.com/app/incy/id6756943388'
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

    const platformNames = { ios: 'iPhone', android: 'Android', macos: 'Mac', windows: 'Windows', linux: 'Linux', tv: 'TV' };
    const pName = platformNames[platform] || 'устройства';
    showToast(`Открываем магазин для ${appName} (${pName})...`);
    setTimeout(() => {
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(targetUrl);
      } else {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    }, 400);
  });
}

async function proceedToKeyView() {
  const pageKeyView = document.getElementById('page-key-view');
  if (!pageKeyView) return;

  const token = getCurrentUserToken();
  if (!token) {
    showToast('Сессия Telegram ещё загружается. Попробуйте через секунду.');
    return;
  }

  // Scenario 2: New device creation confirmed after choosing app
  if (setupFlowMode === 'new-other-device' && pendingNewDevice) {
    if (!deviceOperations?.createDevice) {
      showToast('Сервис создания устройств недоступен.');
      return;
    }
    showToast('Создаём устройство…');
    const requestId = createRequestId();
    try {
      const res = await deviceOperations.createDevice({
        requestId,
        name: pendingNewDevice.name,
        platform: pendingNewDevice.platform || 'unknown',
        target: 'other-device',
      });
      if (res?.status === 'succeeded' && res.device?.id) {
        selectedSetupDeviceId = res.device.id;
        selectedSetupDevice = { ...res.device };
        pendingNewDevice = null;
        setupFlowMode = 'existing-device';
        await loadDeviceList();
        updateDisplayedSubscriptionUrls(currentSelectedApp);
        openOverlay(pageKeyView);
        showToast('Устройство создано и готово к подключению!');
        return;
      }
      showToast(res?.message || 'Не удалось создать устройство на сервере.');
      return;
    } catch (err) {
      showToast(err?.message || 'Ошибка создания устройства.');
      return;
    }
  }

  // Scenario 1: On this device
  if (setupFlowMode === 'this-device' && !selectedSetupDevice) {
    // Check if this device is already in confirmed list
    const existingCurrent = lastConfirmedDeviceList?.devices?.find((d) => d.isCurrent);
    if (existingCurrent) {
      selectedSetupDeviceId = existingCurrent.id;
      selectedSetupDevice = { ...existingCurrent };
      updateDisplayedSubscriptionUrls(currentSelectedApp);
      openOverlay(pageKeyView);
      return;
    }

    if (deviceOperations?.createDevice) {
      showToast('Подготавливаем устройство…');
      const platform = getDevicePlatform();
      const pName = { ios: 'iPhone', android: 'Android', macos: 'Mac', windows: 'ПК' }[platform] || 'Устройство';
      const name = 'Мой ' + pName;
      const requestId = createRequestId();
      try {
        const res = await deviceOperations.createDevice({
          requestId,
          name,
          platform,
          target: 'this-device',
        });
        if (res?.status === 'succeeded' && res.device?.id) {
          selectedSetupDeviceId = res.device.id;
          selectedSetupDevice = { ...res.device };
          await loadDeviceList();
          updateDisplayedSubscriptionUrls(currentSelectedApp);
          openOverlay(pageKeyView);
          return;
        }
        showToast(res?.message || 'Не удалось настроить устройство.');
        return;
      } catch (err) {
        showToast(err?.message || 'Ошибка получения ключа для устройства.');
        return;
      }
    }
  }

  updateDisplayedSubscriptionUrls(currentSelectedApp);
  openOverlay(pageKeyView);
}

if (btnAlreadyHaveApp) {
  btnAlreadyHaveApp.addEventListener('click', proceedToKeyView);
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
    showToast('Демонстрационный режим: инструкция в Telegram-боте не открывается.');
  });
}

if (keyBoxField && userKeyUrl) {
  keyBoxField.addEventListener('click', async () => {
    const selectedRadio = document.querySelector('input[name="app-choice"]:checked');
    const isIncy = selectedRadio && selectedRadio.value === 'incy';
    const subUrl = getSubscriptionUrl(isIncy ? 'incy' : 'karing');
    if (!subUrl) {
      showToast(`Ссылка для ${isIncy ? 'INCY' : 'Karing'} ещё не получена.`);
      return;
    }
    const copied = await copyText(subUrl);
    if (isIncy) {
      showToast(copied ? 'Ссылка скопирована! Откройте INCY и нажмите Вставить' : 'Не удалось скопировать. Нажмите и удерживайте ссылку.');
    } else {
      showToast(copied ? 'Ссылка-подписка скопирована' : 'Не удалось скопировать. Нажмите и удерживайте ссылку.');
    }
  });
}

if (btnAddToApp && userKeyUrl) {
  btnAddToApp.addEventListener('click', async () => {
    const selectedRadio = document.querySelector('input[name="app-choice"]:checked');
    const isIncy = selectedRadio && selectedRadio.value === 'incy';
    const app = isIncy ? 'incy' : 'karing';
    const subUrl = getSubscriptionUrl(app);
    if (!subUrl) {
      showToast(`Ссылка для ${isIncy ? 'INCY' : 'Karing'} ещё не получена.`);
      return;
    }

    // 1. Auto-copy subscription URL to clipboard first so user can paste if needed
    const copied = await copyText(subUrl);

    if (isIncy) {
      // INCY deep link: incy://import/{encoded_url}
      const incyDeepLink = `incy://import/${encodeURIComponent(subUrl)}`;
      showToast('Ссылка скопирована! Открываем INCY... (вставьте ссылку в приложении)');
      setTimeout(() => {
        try {
          window.location.href = incyDeepLink;
        } catch (_) {}
      }, 350);
    } else {
      // Karing deep link scheme with URI-encoded subscription URL
      const encoded = encodeURIComponent(subUrl);
      const karingInstallUrl = `karing://install-config?url=${encoded}`;
      showToast(copied
        ? 'Ссылка скопирована. Переходим в Karing...'
        : 'Открываем Karing...');
      setTimeout(() => {
        try {
          window.location.href = karingInstallUrl;
        } catch (_) {}
      }, 350);
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
    karingUrl: 'https://apps.apple.com/app/karing/id6472431552',
    karingText: 'App Store',
    incyUrl: 'https://apps.apple.com/app/incy/id6756943388',
    incyText: 'App Store'
  },
  android: {
    title: 'Настроить на Android',
    svg: `<svg width="40" height="40" viewBox="0 0 28 28" fill="currentColor"><path d="M3.99078 1.12012L16.1183 13.1601L19.4433 9.83512L4.74328 1.34762C4.49828 1.20543 4.23578 1.12668 3.99078 1.12012ZM2.97578 1.68012C2.86641 1.8748 2.80078 2.10449 2.80078 2.36262V25.7601C2.80078 25.9482 2.84016 26.1167 2.90578 26.2676L15.3133 13.9476L2.97578 1.68012ZM20.4583 10.4126L16.9058 13.9476L20.4583 17.4651L24.7983 14.9801C25.4152 14.6236 25.5027 14.1707 25.4983 13.9301C25.4917 13.532 25.2402 13.1601 24.8158 12.9326C24.4461 12.7336 21.7008 11.1345 20.4583 10.4126ZM16.1183 14.7351L3.88578 26.8626C4.08922 26.8517 4.31016 26.8079 4.51578 26.6876C4.99484 26.4098 14.6833 20.8076 14.6833 20.8076L19.4608 18.0601L16.1183 14.7351Z"/></svg>`,
    karingUrl: 'https://github.com/KaringX/karing/releases/download/v1.2.21.2408/karing_1.2.21.2408_android_arm.apk',
    karingText: 'Google Play / APK',
    incyUrl: 'https://play.google.com/store/apps/details?id=llc.itdev.incy',
    incyText: 'Google Play'
  },
  macos: {
    title: 'Настроить на macOS',
    svg: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    karingUrl: 'https://apps.apple.com/app/karing/id6472431552',
    karingText: 'App Store',
    incyUrl: 'https://apps.apple.com/app/incy/id6756943388',
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
    showToast('Демонстрационный режим: инструкция в Telegram-боте не открывается.');
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
      if (deviceDetailKeyText) deviceDetailKeyText.textContent = getSubscriptionUrl(currentAppChoice);
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
    if (deviceDetailKeyText) deviceDetailKeyText.textContent = getSubscriptionUrl('karing');
    updateDownloadButton();
    updateKaringGuideVisibility();
  });

  btnSelectIncy.addEventListener('click', () => {
    currentAppChoice = 'incy';
    btnSelectIncy.classList.add('active');
    btnSelectKaring.classList.remove('active');
    if (step1Title) step1Title.textContent = 'Скачайте приложение INCY';
    if (deviceDetailKeyText) deviceDetailKeyText.textContent = getSubscriptionUrl('incy');
    updateDownloadButton();
    updateKaringGuideVisibility();
  });
}

// Copy key button inside modal
if (btnDeviceCopyKey) {
  btnDeviceCopyKey.addEventListener('click', async () => {
    const subUrl = getSubscriptionUrl(currentAppChoice);
    if (!subUrl) {
      showToast(`Ссылка для ${currentAppChoice === 'incy' ? 'INCY' : 'Karing'} ещё не получена.`);
      return;
    }
    const copied = await copyText(subUrl);
    if (currentAppChoice === 'incy') {
      showToast(copied ? 'Ссылка скопирована! Откройте INCY и нажмите Вставить' : 'Не удалось скопировать. Нажмите и удерживайте ссылку.');
    } else {
      showToast(copied ? 'Ссылка-подписка скопирована' : 'Не удалось скопировать. Нажмите и удерживайте ссылку.');
    }
  });
}

if (deviceDetailKeyText) {
  deviceDetailKeyText.addEventListener('click', async () => {
    const subUrl = getSubscriptionUrl(currentAppChoice);
    if (!subUrl) {
      showToast(`Ссылка для ${currentAppChoice === 'incy' ? 'INCY' : 'Karing'} ещё не получена.`);
      return;
    }
    const copied = await copyText(subUrl);
    if (currentAppChoice === 'incy') {
      showToast(copied ? 'Ссылка скопирована! Откройте INCY и нажмите Вставить' : 'Не удалось скопировать. Нажмите и удерживайте ссылку.');
    } else {
      showToast(copied ? 'Ссылка-подписка скопирована' : 'Не удалось скопировать. Нажмите и удерживайте ссылку.');
    }
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
    e.preventDefault();
    if (window.Telegram?.WebApp?.openLink) window.Telegram.WebApp.openLink(targetUrl);
    else window.open(targetUrl, '_blank', 'noopener,noreferrer');
  });
}

  autoSelectDefaultAppForCurrentPlatform();
  updateDisplayedSubscriptionUrls(currentSelectedApp);

  function updateSettingsDevicesSubtitle(used, limit) {
    if (!settingsDevicesSubtitle) return;
    const u = Number(used);
    const l = Number(limit);
    if (Number.isFinite(u) && Number.isFinite(l) && l > 0) {
      settingsDevicesSubtitle.textContent = `Подключено: ${u} из ${l}`;
    }
  }

  function syncSettingsDevicesSubtitleFromSnapshot(source) {
    if (!source) return;
    const u = source?.subscription?.usedDevices
      ?? source?.usedDevices
      ?? source?.connected_devices
      ?? source?.user?.connected_devices
      ?? source?.user?.usedDevices;
    const l = source?.subscription?.deviceLimit
      ?? source?.deviceLimit
      ?? source?.device_limit
      ?? source?.user?.device_limit
      ?? source?.user?.deviceLimit;
    updateSettingsDevicesSubtitle(u, l);
  }

  if (settingsDevicesSubtitle) {
    const cached = profileSubscription?.getCachedProfile?.() || profileSubscription?.getSnapshot?.();
    syncSettingsDevicesSubtitleFromSnapshot(cached);

    if (deviceList?.fetchList) {
      loadDeviceList().then((snapshot) => {
        if (snapshot && settingsDevicesSubtitle) {
          updateSettingsDevicesSubtitle(snapshot.usedSlots, snapshot.deviceLimit);
        }
      }).catch(() => {
        if (settingsDevicesSubtitle && settingsDevicesSubtitle.textContent === 'Проверяем устройства…') {
          settingsDevicesSubtitle.textContent = 'Управление устройствами';
        }
      });
    }
  }

  if (typeof profileSubscription?.subscribe === 'function') {
    try {
      profileSubscription.subscribe((snap) => {
        updateDisplayedSubscriptionUrls(currentSelectedApp);
        syncSettingsDevicesSubtitleFromSnapshot(snap);
      });
    } catch (_) {}
  }

  GhostLinkV3.devices = Object.freeze({
    selectAppChoice,
    autoSelectDefaultAppForCurrentPlatform,
    getDevicePlatform,
    getSubscriptionUrl,
    isSafeSubscriptionUrl,
    getCurrentUserToken,
    createRequestId,
    openOtherDevicePicker,
    selectDeviceForSetup,
    getSelectedSetupDeviceId: () => selectedSetupDeviceId,
    getSelectedSetupDevice: () => selectedSetupDevice ? { ...selectedSetupDevice } : null,
    getPendingNewDevice: () => pendingNewDevice ? { ...pendingNewDevice } : null,
    getSetupFlowMode: () => setupFlowMode,
    proceedToKeyView,
    createIncyDeepLink: (url) => url ? `incy://import/${encodeURIComponent(url)}` : '',
    isValidSubToken,
    isSubscriptionReady,
    updateDisplayedSubscriptionUrls,
  });

};
})();
