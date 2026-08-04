// ----------------------------------------------------
// SYSTEM MODULE (WITH DUAL ADAPTER ARCHITECTURE)
// ----------------------------------------------------

const MOCK_SYSTEM_OVERVIEW = {
  overallStatus: 'healthy',
  title: 'Все системы работают',
  description: 'Серьёзных проблем в инфраструктуре не обнаружено',
  checkedAt: '16:08:32',
  observedAt: '16:07:54'
};

const MOCK_SYSTEM_ATTENTION = [
  {
    id: 'att-1',
    severity: 'warning',
    title: 'Резервная копия старше 24 часов',
    description: 'Последняя успешная копия создана вчера в 02:15',
    targetId: 'system-backups'
  },
  {
    id: 'att-2',
    severity: 'warning',
    title: 'Высокая загрузка CPU на Finland-1',
    description: 'Среднее значение за 15 минут: 89%',
    targetId: 'system-servers'
  }
];

const MOCK_SYSTEM_SERVICES = [
  { id: 'xray', name: 'Xray Runtime', status: 'healthy', statusLabel: 'Работает', details: 'Ответ: 42 мс', targetId: 'system-xray' },
  { id: 'database', name: 'База данных', status: 'healthy', statusLabel: 'Работает', details: 'Ответ: 18 мс', targetId: 'system-database' },
  { id: 'bot', name: 'Telegram-бот Worker', status: 'healthy', statusLabel: 'Работает', details: 'Событие: 12 сек. назад', targetId: 'system-bot' },
  { id: 'payments', name: 'Платёжный обработчик', status: 'healthy', statusLabel: 'Работает', details: 'Webhook: 3 мин. назад', targetId: 'system-payments' },
  { id: 'backups', name: 'Резервные копии', status: 'warning', statusLabel: 'Внимание', details: 'Копия: 28 ч. назад', targetId: 'system-backups' },
  { id: 'queues', name: 'Фоновые задачи', status: 'healthy', statusLabel: 'В норме', details: 'В очереди: 12 задач', targetId: 'system-queues' }
];

const MOCK_SYSTEM_SERVERS = [
  {
    id: 'srv-fi-01',
    name: 'Finland-1',
    region: 'Хельсинки',
    status: 'healthy',
    statusLabel: 'Работает',
    cpu: { value: 42, text: '42%', status: 'healthy' },
    ram: { value: 61, text: '4,9 из 8 ГБ (61%)', status: 'healthy' },
    disk: { value: 38, text: '38 из 100 ГБ (38%)', status: 'healthy' },
    loadAvg: '0.64 / 0.72 / 0.81',
    netIn: '62 Мбит/с',
    netOut: '122 Мбит/с',
    netDaily: '418 ГБ',
    uptime: '18 дн. 7 ч.',
    heartbeat: '8 сек. назад',
    os: 'Ubuntu 24.04 LTS',
    agentVersion: '1.8.2',
    lastBoot: '12 июля 2026, 08:42'
  }
];

const MOCK_SYSTEM_EVENTS = [
  {
    id: 'evt-901',
    level: 'audit',
    levelLabel: 'Аудит',
    title: 'Xray перезапущен',
    service: 'Xray Runtime',
    actor: 'Администратор (@admin)',
    timestamp: '16:02:18',
    date: '30 июля 2026, 16:02:18',
    status: 'succeeded',
    safeMessage: 'Перезапуск Xray на Finland-1 завершён успешно. Health-check прошёл.',
    errorCode: 'NONE'
  },
  {
    id: 'evt-899',
    level: 'error',
    levelLabel: 'Ошибка',
    title: 'Ошибка обработки webhook',
    service: 'Payments Subsystem',
    actor: 'System Worker',
    timestamp: '15:48:09',
    date: '30 июля 2026, 15:48:09',
    status: 'failed',
    safeMessage: 'Превышен таймаут ответа платёжного провайдера. Повторная отправка поставлена в очередь.',
    errorCode: 'PAYMENT_HANDLER_TIMEOUT',
    requestId: 'req_82f91'
  },
  {
    id: 'evt-842',
    level: 'warning',
    levelLabel: 'Предупреждение',
    title: 'Backup завершился с предупреждением',
    service: 'Backup Service',
    actor: 'Cron Runner',
    timestamp: '14:31:22',
    date: '30 июля 2026, 14:31:22',
    status: 'warning',
    safeMessage: 'Создана копия (1.8 ГБ), но время выполнения составило 4 мин. 12 сек. Проверка целостности пройдена.',
    errorCode: 'BACKUP_SLOW_EXECUTION'
  }
];

const MOCK_BACKUP_HISTORY = [
  { date: '30 июля, 02:15', status: 'Успешно', size: '1,8 ГБ', duration: '4 мин. 12 сек.', integrity: 'Пройдена' },
  { date: '29 июля, 02:14', status: 'Успешно', size: '1,8 ГБ', duration: '4 мин. 08 сек.', integrity: 'Пройдена' },
  { date: '28 июля, 02:13', status: 'Ошибка', size: '—', duration: '—', integrity: 'Недоступна (Ошибка диска)' }
];

const systemOperationStore = GhostLinkV3.AdminMockSecurity.createAdminMockOperationStore();

const MockSystemAdapter = {
  getOverview: async () => {
    await new Promise(r => setTimeout(r, 200));
    return MOCK_SYSTEM_OVERVIEW;
  },
  getAttention: async () => {
    await new Promise(r => setTimeout(r, 150));
    return MOCK_SYSTEM_ATTENTION;
  },
  getServices: async () => {
    await new Promise(r => setTimeout(r, 150));
    return MOCK_SYSTEM_SERVICES;
  },
  getServers: async () => {
    await new Promise(r => setTimeout(r, 200));
    return MOCK_SYSTEM_SERVERS;
  },
  getServer: async (id) => {
    await new Promise(r => setTimeout(r, 100));
    return MOCK_SYSTEM_SERVERS.find(s => s.id === id);
  },
  checkXray: async (serverId) => {
    await new Promise(r => setTimeout(r, 300));
    return { ok: true, latencyMs: 38, message: `Xray на ${serverId || 'Finland-1'} отвечает корректно · 38 мс` };
  },
  restartXray: async (serverId, requestId) => {
    requireAdminMockAccess('restart_xray');
    await new Promise(r => setTimeout(r, 400));
    return systemOperationStore.start({ requestId, actionType: 'restart_xray', serverId });
  },
  checkDb: async () => {
    await new Promise(r => setTimeout(r, 250));
    return { ok: true, latencyMs: 18, connections: '24 / 100', message: 'Соединение с PostgreSQL стабильно (SELECT 1 · 18 мс)' };
  },
  getBackupsHistory: async () => {
    await new Promise(r => setTimeout(r, 150));
    return MOCK_BACKUP_HISTORY;
  },
  createBackup: async (requestId) => {
    requireAdminMockAccess('create_backup');
    await new Promise(r => setTimeout(r, 350));
    return systemOperationStore.start({ requestId, actionType: 'create_backup' });
  },
  checkBot: async () => {
    await new Promise(r => setTimeout(r, 250));
    return { ok: true, message: 'Бот работает корректно (Webhook доступен · очередь 7 задач)' };
  },
  checkPayments: async () => {
    await new Promise(r => setTimeout(r, 250));
    return { ok: true, message: 'Обработчик платежей доступен (последний Webhook 3 мин. назад)' };
  },
  getEvents: async (params) => {
    await new Promise(r => setTimeout(r, 200));
    let list = [...MOCK_SYSTEM_EVENTS];
    if (params.level && params.level !== 'all') {
      list = list.filter(e => e.level === params.level);
    }
    if (params.query) {
      const q = params.query.toLowerCase();
      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.service.toLowerCase().includes(q) ||
        e.errorCode.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q)
      );
    }
    return list;
  },
  getEvent: async (id) => {
    await new Promise(r => setTimeout(r, 100));
    return MOCK_SYSTEM_EVENTS.find(e => e.id === id);
  },
  getJob: async (jobId) => {
    await new Promise(r => setTimeout(r, 200));
    const record = systemOperationStore.completeByJobId(jobId);
    if (!record) return null;
    return { jobId: record.jobId, requestId: record.requestId, status: record.status, message: 'Локальная mock-операция завершена. Настоящие сервисы не изменялись.' };
  }
};

const BackendSystemAdapter = {
  getOverview: async () => MockSystemAdapter.getOverview(),
  getAttention: async () => MockSystemAdapter.getAttention(),
  getServices: async () => MockSystemAdapter.getServices(),
  getServers: async () => MockSystemAdapter.getServers(),
  getServer: async (id) => MockSystemAdapter.getServer(id),
  checkXray: async (id) => MockSystemAdapter.checkXray(id),
  restartXray: async (id, key) => MockSystemAdapter.restartXray(id, key),
  checkDb: async () => MockSystemAdapter.checkDb(),
  getBackupsHistory: async () => MockSystemAdapter.getBackupsHistory(),
  createBackup: async (key) => MockSystemAdapter.createBackup(key),
  checkBot: async () => MockSystemAdapter.checkBot(),
  checkPayments: async () => MockSystemAdapter.checkPayments(),
  getEvents: async (p) => MockSystemAdapter.getEvents(p),
  getEvent: async (id) => MockSystemAdapter.getEvent(id),
  getJob: async (id) => MockSystemAdapter.getJob(id)
};

const systemApi = protectAdminMockAdapter(MockSystemAdapter);

let systemState = {
  eventLevel: 'all',
  eventQuery: '',
  selectedServer: null,
  selectedEvent: null,
  activeConfirmPayload: null,
  confirmSubmitInFlight: false,
  jobPollingTimer: null,
  refreshing: false
};

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('admin-tab-system')) return;
  initSystemTab();
});

function initSystemTab() {
  // System Events Search Input
  const eventSearchInput = document.getElementById('sysEventSearchInput');
  if (eventSearchInput) {
    eventSearchInput.addEventListener('input', () => {
      systemState.eventQuery = eventSearchInput.value.trim();
      renderSystemEvents();
    });
  }

  // Event Level Chips
  const levelChips = document.querySelectorAll('#sysEventLevelChips .chip-btn');
  levelChips.forEach(chip => {
    chip.addEventListener('click', () => {
      levelChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      systemState.eventLevel = chip.dataset.sysLevel;
      renderSystemEvents();
    });
  });

  // Action Buttons
  document.getElementById('btnSysCheckXray').addEventListener('click', async () => {
    const res = await systemApi.checkXray('Finland-1');
    showToast(res.message);
  });

  document.getElementById('btnSysRestartXray').addEventListener('click', () => {
    openConfirmActionModal({
      title: 'Перезапустить Xray на Finland-1?',
      desc: 'Текущие VPN-подключения на сервере Finland-1 будут временно разорваны на время перезапуска runtime.',
      actionType: 'restart_xray',
      serverId: 'srv-fi-01'
    });
  });

  document.getElementById('btnSysCheckDb').addEventListener('click', async () => {
    const res = await systemApi.checkDb();
    showToast(res.message);
  });

  document.getElementById('btnSysCreateBackup').addEventListener('click', () => {
    openConfirmActionModal({
      title: 'Создать резервную копию базы?',
      desc: 'Во время создания бэкапа нагрузка на дисковую подсистему может временно увеличиться. Сервис продолжит работу.',
      actionType: 'create_backup'
    });
  });

  document.getElementById('btnSysOpenBackupHistory').addEventListener('click', () => {
    openBackupHistoryModal();
  });

  document.getElementById('btnSysCheckBot').addEventListener('click', async () => {
    const res = await systemApi.checkBot();
    showToast(res.message);
  });

  document.getElementById('btnSysCheckPayments').addEventListener('click', async () => {
    const res = await systemApi.checkPayments();
    showToast(res.message);
  });

  // Modals close buttons
  document.getElementById('btnSysServerDetailBack').addEventListener('click', () => {
    closeOverlay(document.getElementById('page-system-server-detail'));
  });

  document.getElementById('btnSysConfirmCancel').addEventListener('click', () => {
    systemState.activeConfirmPayload = null;
    systemState.confirmSubmitInFlight = false;
    document.getElementById('modalSystemConfirmAction').classList.add('hidden');
  });

  document.getElementById('btnSysConfirmSubmit').addEventListener('click', async () => {
    const payload = systemState.activeConfirmPayload;
    if (!payload || payload.confirmationState !== 'armed' || systemState.confirmSubmitInFlight) return;

    systemState.confirmSubmitInFlight = true;
    payload.confirmationState = 'consumed';
    systemState.activeConfirmPayload = null;
    const submitButton = document.getElementById('btnSysConfirmSubmit');
    submitButton.disabled = true;

    document.getElementById('modalSystemConfirmAction').classList.add('hidden');

    try {
      let jobRes;
      if (payload.actionType === 'restart_xray') {
        jobRes = await systemApi.restartXray(payload.serverId, payload.requestId);
        showToast('Локальная задача перезапуска поставлена в очередь...');
      } else if (payload.actionType === 'create_backup') {
        jobRes = await systemApi.createBackup(payload.requestId);
        showToast('Локальная задача создания копии запущена...');
      }

      if (jobRes?.jobId) pollJobStatus(jobRes.jobId);
    } catch (error) {
      showToast(error.code === 'admin_role_required' ? 'Недостаточно прав администратора' : 'Не удалось запустить локальную операцию');
    } finally {
      systemState.confirmSubmitInFlight = false;
      submitButton.disabled = false;
    }
  });

  document.getElementById('btnSysEvtDetailClose').addEventListener('click', () => {
    document.getElementById('modalSystemEventDetail').classList.add('hidden');
  });

  document.getElementById('btnSysBackupHistoryClose').addEventListener('click', () => {
    document.getElementById('modalSystemBackupHistory').classList.add('hidden');
  });

  // Tab visibility lifecycle safety
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopSystemJobPolling();
    }
  });

  // Initial render
  renderSystemTab();
}

async function refreshSystemTab() {
  if (systemState.refreshing) return;
  systemState.refreshing = true;

  try {
    const now = new Date();
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    await renderSystemTab();

    document.getElementById('sysLastRefreshAt').textContent = nowStr;
    showToast('Состояние системы обновлено');
  } catch (err) {
    showToast('Не удалось обновить состояние системы');
  } finally {
    systemState.refreshing = false;
  }
}

async function renderSystemTab() {
  // Overview Banner
  const overview = await systemApi.getOverview();
  const banner = document.getElementById('sysOverallBanner');
  const dot = document.getElementById('sysOverallDot');
  const title = document.getElementById('sysOverallTitle');
  const desc = document.getElementById('sysOverallDesc');
  const checkedAt = document.getElementById('sysOverallCheckedAt');

  if (banner && overview) {
    banner.className = `sys-banner ${overview.overallStatus}`;
    dot.className = `sys-status-dot ${overview.overallStatus}`;
    title.textContent = overview.title;
    desc.textContent = overview.description;
    checkedAt.textContent = `Последняя проверка: ${overview.checkedAt}`;
    document.getElementById('sysObservedAt').textContent = overview.observedAt;
  }

  // Attention Items
  const attention = await systemApi.getAttention();
  const attBlock = document.getElementById('sysAttentionBlock');
  const attContainer = document.getElementById('sysAttentionContainer');

  if (attention && attention.length > 0) {
    attBlock.classList.remove('hidden');
    let aHtml = '';
    attention.forEach(item => {
      aHtml += `
        <div onclick="scrollToSystemSection('${item.targetId}')" style="padding: 10px 12px; background: rgba(255,149,0,0.08); border: 1px solid rgba(255,149,0,0.2); border-radius: 10px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 13px; font-weight: 700; color: #fff;">${item.title}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.6);">${item.description}</div>
          </div>
          <div style="color: #FF9500; font-size: 16px;">→</div>
        </div>
      `;
    });
    attContainer.innerHTML = aHtml;
  } else {
    attBlock.classList.add('hidden');
  }

  // Services Grid
  const services = await systemApi.getServices();
  const sGrid = document.getElementById('sysServicesGrid');
  if (sGrid && services) {
    let sHtml = '';
    services.forEach(s => {
      sHtml += `
        <div class="sys-service-card" onclick="scrollToSystemSection('${s.targetId}')">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <div class="sys-status-dot ${s.status}"></div>
            <div style="font-size: 12px; font-weight: 700; color: #fff;">${s.name}</div>
          </div>
          <div style="font-size: 11px; color: ${s.status === 'healthy' ? 'var(--lime)' : '#FF9500'}; font-weight: 600;">${s.statusLabel}</div>
          <div style="font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 2px;">${s.details}</div>
        </div>
      `;
    });
    sGrid.innerHTML = sHtml;
  }

  // Servers List
  renderSystemServers();

  // Events Log
  renderSystemEvents();
}

async function renderSystemServers() {
  const container = document.getElementById('system-server-list');
  if (!container) return;

  const servers = await systemApi.getServers();
  const countText = servers.length === 1 ? '1 сервер' : (servers.length < 5 ? `${servers.length} сервера` : `${servers.length} серверов`);
  document.getElementById('sysServersCountLabel').textContent = countText;

  let html = '';
  servers.forEach(s => {
    html += `
      <div class="admin-list-card" style="padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
          <div>
            <div style="font-size: 15px; font-weight: 700; color: #fff;">${s.name}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.5);">${s.region} · ${s.id}</div>
          </div>
          <span class="sys-badge ${s.status}">● ${s.statusLabel}</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; margin-bottom: 12px;">
          <div class="sys-metric-row">
            <span>CPU</span>
            <span class="sys-metric-val metric--${s.cpu.status}">${s.cpu.text}</span>
          </div>
          <div class="sys-metric-row">
            <span>RAM</span>
            <span class="sys-metric-val metric--${s.ram.status}">${s.ram.text}</span>
          </div>
          <div class="sys-metric-row">
            <span>Диск</span>
            <span class="sys-metric-val metric--${s.disk.status}">${s.disk.text}</span>
          </div>
          <div class="sys-metric-row">
            <span>Трафик</span>
            <span class="sys-metric-val">${s.netOut}</span>
          </div>
          <div class="sys-metric-row">
            <span>Uptime</span>
            <span class="sys-metric-val">${s.uptime}</span>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; pt: 8px; border-top: 1px solid rgba(255,255,255,0.05);">
          <span style="font-size: 10px; color: rgba(255,255,255,0.4);">Heartbeat: ${s.heartbeat}</span>
          <button class="chip-btn" onclick="openSystemServerDetail('${s.id}')" style="font-size: 11px; padding: 4px 10px;">Подробнее</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

async function renderSystemEvents() {
  const container = document.getElementById('sysEventsListContainer');
  if (!container) return;

  const events = await systemApi.getEvents({
    level: systemState.eventLevel,
    query: systemState.eventQuery
  });

  if (events.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:rgba(255,255,255,0.4); padding:20px 0; font-size:12px;">Системные события не найдены</div>`;
    return;
  }

  let html = '';
  events.forEach(e => {
    const isError = e.level === 'error';
    const isWarning = e.level === 'warning';
    const badgeColor = isError ? '#FF3B30' : (isWarning ? '#FF9500' : 'var(--lime)');

    html += `
      <div class="user-item-row" onclick="openSystemEventDetail('${e.id}')" style="cursor: pointer; padding: 8px 10px;">
        <div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 10px; font-weight: 700; color: ${badgeColor}; border: 1px solid ${badgeColor}; padding: 1px 4px; border-radius: 4px;">${e.levelLabel}</span>
            <span style="font-size: 13px; font-weight: 600; color: #fff;">${e.title}</span>
          </div>
          <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px;">${e.service} · ${e.actor}</div>
        </div>
        <div style="text-align: right; font-size: 11px; color: rgba(255,255,255,0.4);">
          ${e.timestamp}
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

async function openSystemServerDetail(serverId) {
  const s = await systemApi.getServer(serverId);
  if (!s) return;

  systemState.selectedServer = s;

  document.getElementById('sysSdTitle').textContent = s.name;
  document.getElementById('sysSdName').textContent = s.name;
  document.getElementById('sysSdRegion').textContent = `${s.region} · ${s.id}`;
  
  const badge = document.getElementById('sysSdStatusBadge');
  badge.className = `sys-badge ${s.status}`;
  badge.textContent = `● ${s.statusLabel}`;

  document.getElementById('sysSdCpu').textContent = s.cpu.text;
  document.getElementById('sysSdRam').textContent = s.ram.text;
  document.getElementById('sysSdDisk').textContent = s.disk.text;
  document.getElementById('sysSdLoadAvg').textContent = s.loadAvg;
  document.getElementById('sysSdUptime').textContent = s.uptime;
  document.getElementById('sysSdHeartbeat').textContent = s.heartbeat;

  document.getElementById('sysSdNetIn').textContent = s.netIn;
  document.getElementById('sysSdNetOut').textContent = s.netOut;
  document.getElementById('sysSdNetDaily').textContent = s.netDaily;

  document.getElementById('sysSdInternalId').textContent = s.id;
  document.getElementById('sysSdOs').textContent = s.os;
  document.getElementById('sysSdAgentVersion').textContent = s.agentVersion;
  document.getElementById('sysSdLastBoot').textContent = s.lastBoot;

  openOverlay(document.getElementById('page-system-server-detail'));
}

async function openSystemEventDetail(eventId) {
  const e = await systemApi.getEvent(eventId);
  if (!e) return;

  systemState.selectedEvent = e;
  document.getElementById('sysEvtDetailTitle').textContent = e.title;

  const content = document.getElementById('sysEvtDetailContent');
  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
      <span style="color:rgba(255,255,255,0.5);">Event ID</span>
      <span style="color:#fff; font-family:monospace;">${e.id}</span>
    </div>
    <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
      <span style="color:rgba(255,255,255,0.5);">Сервис</span>
      <span style="color:#fff; font-weight:600;">${e.service}</span>
    </div>
    <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
      <span style="color:rgba(255,255,255,0.5);">Время</span>
      <span style="color:#fff;">${e.date}</span>
    </div>
    <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
      <span style="color:rgba(255,255,255,0.5);">Инициатор</span>
      <span style="color:#fff;">${e.actor}</span>
    </div>
    ${e.errorCode ? `
      <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
        <span style="color:rgba(255,255,255,0.5);">Код ошибки</span>
        <span style="color:#FF3B30; font-family:monospace;">${e.errorCode}</span>
      </div>
    ` : ''}
    ${e.requestId ? `
      <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
        <span style="color:rgba(255,255,255,0.5);">Request ID</span>
        <span style="color:var(--lime); font-family:monospace;">${e.requestId}</span>
      </div>
    ` : ''}
    <div style="margin-top:8px; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.06); font-size:12px; color:rgba(255,255,255,0.8); line-height:1.4;">
      ${e.safeMessage}
    </div>
  `;

  document.getElementById('modalSystemEventDetail').classList.remove('hidden');
}

async function openBackupHistoryModal() {
  const history = await systemApi.getBackupsHistory();
  const container = document.getElementById('sysBackupHistoryContainer');

  let html = '';
  history.forEach(b => {
    html += `
      <div style="padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; font-size: 12px;">
        <div style="display: flex; justify-content: space-between; font-weight: 700; color: #fff; margin-bottom: 4px;">
          <span>${b.date}</span>
          <span style="color: ${b.status === 'Успешно' ? 'var(--lime)' : '#FF3B30'};">${b.status}</span>
        </div>
        <div style="font-size: 11px; color: rgba(255,255,255,0.5);">
          Размер: ${b.size} · Длительность: ${b.duration} · Целостность: <span style="color:#fff;">${b.integrity}</span>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
  document.getElementById('modalSystemBackupHistory').classList.remove('hidden');
}

function openConfirmActionModal(payload) {
  try {
    requireAdminMockAccess(payload.actionType);
  } catch (error) {
    showToast('Недостаточно прав администратора');
    return;
  }
  const requestId = `mock-admin-${payload.actionType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  systemState.activeConfirmPayload = { ...payload, requestId, confirmationState: 'armed' };
  systemState.confirmSubmitInFlight = false;
  document.getElementById('btnSysConfirmSubmit').disabled = false;
  document.getElementById('sysConfirmModalTitle').textContent = payload.title;
  document.getElementById('sysConfirmModalDesc').textContent = payload.desc;
  document.getElementById('modalSystemConfirmAction').classList.remove('hidden');
}

function pollJobStatus(jobId) {
  stopSystemJobPolling();
  systemState.jobPollingTimer = setInterval(async () => {
    const job = await systemApi.getJob(jobId);
    if (job && job.status === 'succeeded') {
      stopSystemJobPolling();
      showToast(job.message || 'Операция успешно завершена!');
      renderSystemTab();
    } else if (job && job.status === 'failed') {
      stopSystemJobPolling();
      showToast('Не удалось выполнить операцию');
    }
  }, 1000);
}

function stopSystemJobPolling() {
  if (systemState.jobPollingTimer) {
    clearInterval(systemState.jobPollingTimer);
    systemState.jobPollingTimer = null;
  }
}

function scrollToSystemSection(targetId) {
  if (!targetId) return;
  const el = document.getElementById(targetId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// The mock admin lists still render a few rows from template strings. Keep this
// narrow bridge until those rows are moved to DOM event listeners in Stage 3.
Object.assign(window, {
  handleUserRowClick,
  openFullHistoryModal,
  togglePlanFilter,
  resetAllFinFilters,
  openFinancePaymentDetail,
  scrollToSystemSection,
  openSystemServerDetail,
  openSystemEventDetail,
});
