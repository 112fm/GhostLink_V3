// ----------------------------------------------------
// Admin Dashboard Logic
// ----------------------------------------------------

// The local role belongs to the adapter/action boundary, not a visible button.
// Production must replace this mock session with server-verified Telegram roles.
const adminMockSession = GhostLinkV3.adminMockSession;
const IS_ADMIN = Boolean(adminMockSession?.isAdmin());

function requireAdminMockAccess(action) {
  return adminMockSession?.assertAdmin(action);
}

function protectAdminMockAdapter(adapter) {
  return GhostLinkV3.AdminMockSecurity.protectAdminAdapter(adapter, adminMockSession);
}

const analyticsData = {
  month: {
    label: 'Этот месяц',
    dynamicsMode: 'month',
    dynamicsTitle: 'Активная база — Июль',
    monthDynamics: {
      start: '1 624',
      newPaid: '+157',
      returned: '+12',
      churn: '−18',
      disabled: '−12',
      current: '1 763'
    },
    financeMode: 'single',
    income: '187 300 ₽',
    paidCount: 364,
    avgCheck: '515 ₽',
    rejected: 7,
    pending: 3
  },
  '3m': {
    label: '3 месяца',
    dynamicsMode: '3m',
    dynamicsTitle: 'Динамика по месяцам',
    monthlyProgression: [
      { month: 'Май', range: '1 410 → 1 521', change: '+111' },
      { month: 'Июнь', range: '1 521 → 1 624', change: '+103' },
      { month: 'Июль', range: '1 624 → 1 763', change: '+139' }
    ],
    financeMode: '3months',
    monthsBreakdown: [
      { month: 'Май', income: '158 400 ₽' },
      { month: 'Июнь', income: '173 900 ₽' },
      { month: 'Июль', income: '187 300 ₽' }
    ],
    totalIncome: '519 600 ₽',
    paidCount: 1012,
    avgCheck: '513 ₽',
    rejected: 18,
    pending: 3
  },
  all: {
    label: 'Всё время',
    dynamicsMode: 'all',
    dynamicsTitle: 'Накопительные итоги',
    allTimeTotals: [
      { label: 'Всего уникальных плательщиков', val: '2 140' },
      { label: 'Сейчас активны', val: '1 763', class: 'pos' },
      { label: 'Сейчас неактивны', val: '377', class: 'neg' },
      { label: 'Вернулись после перерыва', val: '142' },
      { label: 'Всего подтверждённых оплат', val: '1 840' },
      { label: 'Общий доход', val: '942 500 ₽', bold: true }
    ],
    financeMode: 'single',
    income: '942 500 ₽',
    paidCount: 1840,
    avgCheck: '512 ₽',
    rejected: 32,
    pending: 3
  }
};

const servers = [
  {
    id: "finland-1",
    name: "Finland-1",
    status: "online",
    cpuPercent: 88,
    ramPercent: 42,
    diskPercent: 65,
    diskUsedGb: 20.8,
    diskTotalGb: 32,
    uploadMbps: 342,
    downloadMbps: 45,
    traffic30dTb: 42.5,
    uptimeString: "18 дней",
    xrayStatus: "Работает"
  }
];

// Dashboard uses one snapshot so no card can silently display a conflicting
// value. API integration will replace only loadDashboardSnapshot().
const dashboardMockSnapshot = Object.freeze({
  service: {
    level: 'yellow',
    title: 'Сервис работает, есть предупреждения',
    items: ['Xray', 'База', 'Платёжный процесс', 'Бэкап'],
  },
  actionItems: ['3 платежа ожидают подтверждения'],
  warningItems: ['CPU Finland-1: 88%', 'Бэкап старше 24 часов'],
  metrics: {
    online: '1 240',
    active: '1 763',
    approved: '17 · 8 540 ₽',
    newPayers: '18',
  },
  expiring: {
    today: '12',
    renewed: '5',
    left: '7',
    tomorrow: '18',
    week: '84',
  },
  infrastructure: servers,
});

let dashboardRefreshInFlight = false;
let adminTabRefreshInFlight = false;
let dashboardLastSnapshot = null;

function appendDashboardList(container, items) {
  if (!container) return;
  container.replaceChildren();
  items.forEach(item => {
    const listItem = document.createElement('li');
    listItem.textContent = item;
    container.appendChild(listItem);
  });
}

function renderDashboardSnapshot(snapshot) {
  const serviceDot = document.getElementById('dashboard-service-dot');
  const serviceTitle = document.getElementById('dashboard-service-title');
  const serviceItems = document.getElementById('dashboard-service-items');
  const metricIds = {
    online: 'dashboard-metric-online',
    active: 'dashboard-metric-active',
    approved: 'dashboard-metric-approved',
    newPayers: 'dashboard-metric-new-payers',
  };
  const expiringIds = {
    today: 'exp-today',
    renewed: 'exp-today-renewed',
    left: 'exp-today-left',
    tomorrow: 'exp-tomorrow',
    week: 'exp-week',
  };

  if (serviceDot) serviceDot.className = `status-dot ${snapshot.service.level}`;
  if (serviceTitle) serviceTitle.textContent = snapshot.service.title;
  if (serviceItems) serviceItems.textContent = snapshot.service.items.join(' · ');
  appendDashboardList(document.getElementById('dashboard-action-items'), snapshot.actionItems);
  appendDashboardList(document.getElementById('dashboard-warning-items'), snapshot.warningItems);

  Object.entries(metricIds).forEach(([key, id]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = snapshot.metrics[key];
  });
  Object.entries(expiringIds).forEach(([key, id]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = snapshot.expiring[key];
  });

  renderInfra(snapshot.infrastructure);
  animateProgressBars();
}

function setDashboardRefreshState(state) {
  const label = document.getElementById('admin-last-updated');
  const refreshButton = document.getElementById('btnAdminRefresh');
  if (refreshButton) {
    refreshButton.disabled = state === 'loading';
    refreshButton.classList.toggle('is-refreshing', state === 'loading');
  }
  if (!label) return;

  if (state === 'loading') label.textContent = 'Обновляю…';
  if (state === 'ready') label.textContent = `Тестовые данные · обновлено в ${formatAdminRefreshTime()}`;
  if (state === 'stale') label.textContent = 'Данные устарели · повторите обновление';
}

function formatAdminRefreshTime() {
  return new Date().toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

async function loadDashboardSnapshot() {
  // Future: GET /api/admin/dashboard after server-side role verification.
  return dashboardMockSnapshot;
}

async function refreshDashboard() {
  if (dashboardRefreshInFlight) return;
  dashboardRefreshInFlight = true;
  setDashboardRefreshState('loading');

  try {
    const snapshot = await loadDashboardSnapshot();
    dashboardLastSnapshot = snapshot;
    renderDashboardSnapshot(snapshot);
    setDashboardRefreshState('ready');
    showToast(`Dashboard обновлён в ${formatAdminRefreshTime()}`);
  } catch (error) {
    if (dashboardLastSnapshot) renderDashboardSnapshot(dashboardLastSnapshot);
    setDashboardRefreshState('stale');
    showToast('Не удалось обновить Dashboard. Показаны последние данные.');
  } finally {
    dashboardRefreshInFlight = false;
  }
}

async function refreshActiveAdminTab() {
  const activeTab = document.querySelector('#admin-main-nav .admin-tab-btn.active')?.dataset.tab || 'dashboard';
  if (activeTab === 'dashboard') {
    await refreshDashboard();
    return;
  }
  if (adminTabRefreshInFlight) return;

  const refreshButton = document.getElementById('btnAdminRefresh');
  const statusLabel = document.getElementById('admin-last-updated');
  const tabLabels = {
    users: 'пользователей',
    finance: 'финансов',
    partners: 'партнёров',
    system: 'системы'
  };
  adminTabRefreshInFlight = true;
  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.classList.add('is-refreshing');
  }
  if (statusLabel) statusLabel.textContent = `Обновляю ${tabLabels[activeTab] || 'данные'}...`;

  try {
    if (activeTab === 'users') {
      currentUsers = await userApi.getUsers();
      renderUsersList();
    } else if (activeTab === 'finance') {
      await renderFinanceTab();
    } else if (activeTab === 'partners') {
      await renderPartnersTab();
    } else if (activeTab === 'system') {
      await refreshSystemTab();
    }
    if (statusLabel) statusLabel.textContent = `Тестовые данные · обновлено в ${formatAdminRefreshTime()}`;
    showToast(`${tabLabels[activeTab] || 'Данные'} обновлены`);
  } catch (error) {
    if (statusLabel) statusLabel.textContent = 'Тестовые данные · не обновлены';
    showToast('Не удалось обновить текущий раздел');
  } finally {
    adminTabRefreshInFlight = false;
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.classList.remove('is-refreshing');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btnSettingsAdmin = document.getElementById('btnSettingsAdmin');
  const pageAdminDashboard = document.getElementById('page-admin-dashboard');
  const btnAdminBack = document.getElementById('btnAdminBack');

  if (!IS_ADMIN) {
    // Remove the local prototype from the user DOM instead of merely hiding it.
    // This is not the final security boundary: the public build must exclude
    // admin markup and logic, while the API enforces the actual role check.
    btnSettingsAdmin?.remove();
    pageAdminDashboard?.remove();
    return;
  }

  if (btnSettingsAdmin && pageAdminDashboard) {
    btnSettingsAdmin.style.display = 'flex';
    btnSettingsAdmin.addEventListener('click', () => {
      openOverlay(pageAdminDashboard);
      refreshDashboard();
    });
  }

  if (btnAdminBack && pageAdminDashboard) {
    btnAdminBack.addEventListener('click', () => {
      closeOverlay(pageAdminDashboard);
    });
  }

  const btnAdminRefresh = document.getElementById('btnAdminRefresh');
  btnAdminRefresh?.addEventListener('click', refreshActiveAdminTab);

  // Main Tabs
  const adminNavBtns = document.querySelectorAll('#admin-main-nav .admin-tab-btn');
  const adminTabContents = document.querySelectorAll('.admin-tab-content');

  adminNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      adminNavBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetTabId = 'admin-tab-' + btn.dataset.tab;
      adminTabContents.forEach(tab => {
        if (tab.id === targetTabId) {
          tab.classList.add('active');
          tab.style.display = 'flex';
        } else {
          tab.classList.remove('active');
          tab.style.display = 'none';
        }
      });
    });
  });

  // Analytics Period Selector
  const analyticsPeriodBtns = document.querySelectorAll('#admin-analytics-period .admin-segment-btn');
  analyticsPeriodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      analyticsPeriodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateAnalyticsData(btn.dataset.period);
    });
  });

  // Initial Analytics Render
  updateAnalyticsData('month');
});

function getProgressColor(percent) {
  if (percent < 70) return 'rgba(184, 255, 0, 0.4)'; // up to 69% (dimmer lime)
  if (percent < 85) return '#FFCC00'; // 70-84%
  return '#FF3B30'; // 85%+
}

function renderInfra(infrastructure = servers) {
  const container = document.getElementById('infra-container');
  if (!container) return;
  container.innerHTML = '';
  
  infrastructure.forEach(srv => {
    const isOnline = srv.status === 'online';
    
    container.innerHTML += `
      <div class="infra-header" style="align-items: flex-start;">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div class="infra-name">${srv.name}</div>
          <div style="font-size:11px; color:rgba(255,255,255,0.4);">обновлено 8 сек. назад</div>
        </div>
        <div class="infra-status ${!isOnline ? 'offline' : ''}">${isOnline ? 'Онлайн' : 'Офлайн'}</div>
      </div>
      <div class="infra-bars">
        <div class="infra-bar-row">
          <div class="infra-bar-labels">
            <span class="infra-bar-title">CPU</span>
            <span class="infra-bar-val">${srv.cpuPercent}% <span style="font-size:12px; margin-left:8px; color:rgba(255,255,255,0.4);">${srv.cpuPercent >= 85 ? 'Высокая нагрузка' : 'Норма'}</span></span>
          </div>
          <div class="progress-bg">
            <div class="progress-fill" data-width="${srv.cpuPercent}%" style="width: 0%; background-color: ${getProgressColor(srv.cpuPercent)};"></div>
          </div>
        </div>
        <div class="infra-bar-row">
          <div class="infra-bar-labels">
            <span class="infra-bar-title">RAM</span>
            <span class="infra-bar-val">${srv.ramPercent}% <span style="font-size:12px; margin-left:8px; color:rgba(255,255,255,0.4);">${srv.ramPercent >= 85 ? 'Высокая нагрузка' : 'Норма'}</span></span>
          </div>
          <div class="progress-bg">
            <div class="progress-fill" data-width="${srv.ramPercent}%" style="width: 0%; background-color: ${getProgressColor(srv.ramPercent)};"></div>
          </div>
        </div>
        <div class="infra-bar-row">
          <div class="infra-bar-labels">
            <span class="infra-bar-title">Диск</span>
            <span class="infra-bar-val">${srv.diskPercent}% <span style="font-size:12px; margin-left:8px; color:rgba(255,255,255,0.4);">${srv.diskUsedGb} / ${srv.diskTotalGb} ГБ</span></span>
          </div>
          <div class="progress-bg">
            <div class="progress-fill" data-width="${srv.diskPercent}%" style="width: 0%; background-color: ${getProgressColor(srv.diskPercent)};"></div>
          </div>
        </div>
      </div>
      
      <div class="infra-metrics">
        <div class="infra-metric-row">
          <span>Сеть</span>
          <span class="infra-metric-val" style="color: var(--lime);">↑${srv.uploadMbps} <span style="color: rgba(255,255,255,0.4);">·</span> <span style="color: #4DA2FF;">↓${srv.downloadMbps} Мбит/с</span></span>
        </div>
        <div class="infra-metric-row">
          <span>Трафик</span>
          <span class="infra-metric-val">${srv.traffic30dTb} ТБ за 30 дней</span>
        </div>
        <div class="infra-metric-row">
          <span>Uptime</span>
          <span class="infra-metric-val">${srv.uptimeString}</span>
        </div>
        <div class="infra-metric-row">
          <span>Xray</span>
          <span class="infra-metric-val">${srv.xrayStatus}</span>
        </div>
      </div>
    `;
  });
}

function animateProgressBars() {
  const fills = document.querySelectorAll('.progress-fill');
  fills.forEach(fill => {
    fill.style.width = fill.dataset.width;
  });
}

function updateAnalyticsData(periodKey) {
  const data = analyticsData[periodKey];
  if (!data) return;

  // Dynamics rendering
  const dynTitle = document.getElementById('dynamics-title');
  const dynCard = document.getElementById('dynamics-card');
  if (dynTitle) dynTitle.textContent = data.dynamicsTitle;
  
  if (dynCard) {
    if (data.dynamicsMode === 'month') {
      const d = data.monthDynamics;
      dynCard.innerHTML = `
        <div class="admin-list-row">
          <span class="admin-list-label">Активные на начало месяца</span>
          <span class="admin-list-val">${d.start}</span>
        </div>
        <div class="admin-list-row">
          <span class="admin-list-label">+ впервые оплатили</span>
          <span class="admin-list-val pos">${d.newPaid}</span>
        </div>
        <div class="admin-list-row">
          <span class="admin-list-label">+ вернулись после перерыва</span>
          <span class="admin-list-val pos">${d.returned}</span>
        </div>
        <div class="admin-list-row">
          <span class="admin-list-label">− не продлили</span>
          <span class="admin-list-val neg">${d.churn}</span>
        </div>
        <div class="admin-list-row">
          <span class="admin-list-label">− отключены вручную</span>
          <span class="admin-list-val neg">${d.disabled}</span>
        </div>
        <div class="admin-list-row total-row">
          <span class="admin-list-label" style="font-weight:600; color:#fff;">= активные сейчас</span>
          <span class="admin-list-val" style="font-size: 17px; font-weight:700;">${d.current}</span>
        </div>
      `;
    } else if (data.dynamicsMode === '3m') {
      let rowsHtml = '';
      data.monthlyProgression.forEach(item => {
        rowsHtml += `
          <div class="admin-list-row">
            <span class="admin-list-label">${item.month}</span>
            <span class="admin-list-val" style="font-size:14px; font-weight:400; color:rgba(255,255,255,0.7);">${item.range} &nbsp;<strong class="pos" style="font-size:15px;">(${item.change})</strong></span>
          </div>
        `;
      });
      dynCard.innerHTML = rowsHtml;
    } else if (data.dynamicsMode === 'all') {
      let rowsHtml = '';
      data.allTimeTotals.forEach(item => {
        const valClass = item.class ? item.class : '';
        const style = item.bold ? 'font-size: 17px; font-weight: 700;' : '';
        const labelStyle = item.bold ? 'font-weight: 600; color: #fff;' : '';
        rowsHtml += `
          <div class="admin-list-row ${item.bold ? 'total-row' : ''}">
            <span class="admin-list-label" style="${labelStyle}">${item.label}</span>
            <span class="admin-list-val ${valClass}" style="${style}">${item.val}</span>
          </div>
        `;
      });
      dynCard.innerHTML = rowsHtml;
    }
  }

  // Finance rendering
  const finTitle = document.getElementById('finance-analytics-title');
  const finCard = document.getElementById('finance-analytics-card');
  if (finTitle) finTitle.textContent = `Финансы — ${data.label}`;
  
  if (!finCard) return;

  if (data.financeMode === '3months') {
    let rowsHtml = `
      <div class="admin-list-row total-row" style="border-top: none; padding-top: 0; padding-bottom: 12px; flex-direction: column; align-items: flex-start; gap: 4px;">
        <div style="display: flex; justify-content: space-between; width: 100%;">
          <span class="admin-list-label">Доход за 3 месяца</span>
          <span class="admin-list-val" style="font-size: 20px;">${data.totalIncome}</span>
        </div>
        <div style="font-size: 12px; color: rgba(255,255,255,0.4);">динамика по месяцам</div>
      </div>
    `;
    data.monthsBreakdown.forEach(item => {
      rowsHtml += `
        <div class="admin-list-row">
          <span class="admin-list-label">${item.month}</span>
          <span class="admin-list-val">${item.income}</span>
        </div>
      `;
    });
    rowsHtml += `
      <div class="admin-list-row" style="margin-top:8px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.06);">
        <span class="admin-list-label">Всего оплат</span>
        <span class="admin-list-val">${data.paidCount}</span>
      </div>
      <div class="admin-list-row">
        <span class="admin-list-label">Средний чек</span>
        <span class="admin-list-val">${data.avgCheck}</span>
      </div>
    `;
    finCard.innerHTML = rowsHtml;
  } else {
    finCard.innerHTML = `
      <div class="admin-list-row total-row" style="border-top: none; padding-top: 0; padding-bottom: 16px; flex-direction: column; align-items: flex-start; gap: 4px;">
        <div style="display: flex; justify-content: space-between; width: 100%;">
          <span class="admin-list-label">Доход</span>
          <span class="admin-list-val" style="font-size: 20px;">${data.income}</span>
        </div>
        <div style="font-size: 12px; color: rgba(255,255,255,0.4);">только подтверждённые платежи</div>
      </div>
      <div class="admin-list-row">
        <span class="admin-list-label">Подтверждено оплат</span>
        <span class="admin-list-val">${data.paidCount}</span>
      </div>
      <div class="admin-list-row">
        <span class="admin-list-label">Средний чек</span>
        <span class="admin-list-val">${data.avgCheck}</span>
      </div>
      <div class="admin-list-row">
        <span class="admin-list-label">Отклонено</span>
        <span class="admin-list-val">${data.rejected}</span>
      </div>
      <div class="admin-list-row clickable-row">
        <span class="admin-list-label" style="color: #FF9500;">Ожидает подтверждения</span>
        <span class="admin-list-val" style="color: #FF9500;">${data.pending}</span>
      </div>
    `;
  }
}
