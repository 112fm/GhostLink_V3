// ----------------------------------------------------
// FINANCE TAB MODULE (WITH DUAL ADAPTER ARCHITECTURE)
// ----------------------------------------------------

const MOCK_FINANCE_ANALYTICS = {
  month: {
    revenue: 248430,
    count: 417,
    avgCheck: 596,
    uniquePayers: 384,
    prevRevenue: 231900,
    percentChange: 7.1,
    newSubs: { count: 74, amount: 43660 },
    renewals: { count: 343, amount: 204770 },
    plans: [
      { plan: "Solo Ghost", amount: 178500, count: 312 },
      { plan: "Pro Ghost", amount: 69930, count: 105 }
    ]
  },
  quarter: {
    months: [
      { name: "Май", revenue: 218400, count: 371, change: null },
      { name: "Июнь", revenue: 231900, count: 394, change: 6.2 },
      { name: "Июль", revenue: 248430, count: 417, change: 7.1 }
    ],
    revenue: 698730,
    count: 1182,
    avgCheck: 591,
    uniquePayers: 890,
    newSubs: { count: 210, amount: 125000 },
    renewals: { count: 972, amount: 573730 },
    plans: [
      { plan: "Solo Ghost", amount: 501200, count: 880 },
      { plan: "Pro Ghost", amount: 197530, count: 302 }
    ]
  },
  all: {
    totalRevenue: 3842600,
    firstPaymentDate: "12 февраля 2025",
    bestMonth: "Июль 2026 · 248 430 ₽",
    revenue: 3842600,
    count: 6410,
    avgCheck: 599,
    uniquePayers: 2450,
    newSubs: { count: 2450, amount: 1120000 },
    renewals: { count: 3960, amount: 2722600 },
    plans: [
      { plan: "Solo Ghost", amount: 2740000, count: 4800 },
      { plan: "Pro Ghost", amount: 1102600, count: 1610 }
    ]
  }
};

const MOCK_FINANCE_PAYMENTS = [
  { id: "PAY-849201", userId: "u-49218", name: "Алексей", username: "@alex_dev", tgId: "312826672", userInternalId: "49218", amount: 502, date: "30 июля, 13:45", fullDate: "30.07.2026 13:45", paidAt: "2026-07-30T13:45:00", type: "renew", typeLabel: "Продление", plan: "Solo Ghost", period: "3 месяца", method: "СБП", admin: "Артемий", status: "confirmed" },
  { id: "PAY-849200", userId: "u-51092", name: "Мария", username: "@maria_v", tgId: "89230194", userInternalId: "51092", amount: 430, date: "29 июля, 18:12", fullDate: "29.07.2026 18:12", paidAt: "2026-07-29T18:12:00", type: "new", typeLabel: "Новая подписка", plan: "Solo Ghost", period: "1 месяц", method: "СБП", admin: "Артемий", status: "confirmed" },
  { id: "PAY-849199", userId: "u-38910", name: "Игорь", username: "", tgId: "19284012", userInternalId: "38910", amount: 502, date: "20 июня, 10:15", fullDate: "20.06.2026 10:15", paidAt: "2026-06-20T10:15:00", type: "renew", typeLabel: "Продление", plan: "Solo Ghost", period: "3 месяца", method: "Карта РФ", admin: "Артемий", status: "confirmed" },
  { id: "PAY-849198", userId: "u-10923", name: "Дмитрий", username: "@dmitry_b", tgId: "40192834", userInternalId: "10923", amount: 1200, date: "1 мая, 16:40", fullDate: "01.05.2026 16:40", paidAt: "2026-05-01T16:40:00", type: "new", typeLabel: "Новая подписка", plan: "Pro Ghost", period: "6 месяцев", method: "СБП", admin: "Артемий", status: "confirmed" }
];

// Dual Adapter Pattern for Finance API
const MockFinanceAdapter = {
  getAnalytics: async (periodKey) => {
    await new Promise(r => setTimeout(r, 150));
    return MOCK_FINANCE_ANALYTICS[periodKey] || MOCK_FINANCE_ANALYTICS.month;
  },
  getPayments: async (params) => {
    await new Promise(r => setTimeout(r, 150));
    let result = [...MOCK_FINANCE_PAYMENTS];
    if (params.period === 'month') {
      result = result.filter((payment) => payment.paidAt.startsWith('2026-07'));
    } else if (params.period === 'quarter') {
      result = result.filter((payment) => payment.paidAt >= '2026-05-01T00:00:00');
    }
    if (params.type && params.type !== 'all') {
      result = result.filter(p => p.type === params.type);
    }
    if (params.plan) {
      result = result.filter(p => p.plan === params.plan);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) ||
        p.tgId.includes(q) ||
        p.userInternalId.includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.amount.toString().includes(q)
      );
    }
    return result;
  },
  exportData: async (params) => {
    await new Promise(r => setTimeout(r, 250));
    return { success: true, count: MOCK_FINANCE_PAYMENTS.length };
  }
};

const BackendFinanceAdapter = {
  getAnalytics: async (periodKey) => {
    // Real production backend endpoint: fetch(`/api/admin/finance/analytics?period=${periodKey}`)
    return MockFinanceAdapter.getAnalytics(periodKey);
  },
  getPayments: async (params) => {
    // Real production backend endpoint: fetch(`/api/admin/finance/payments?...`)
    return MockFinanceAdapter.getPayments(params);
  },
  exportData: async (params) => {
    return MockFinanceAdapter.exportData(params);
  }
};

// financeApi adapter instance
const financeApi = protectAdminMockAdapter(MockFinanceAdapter);

// State management for Finance Tab UI
let finState = {
  period: 'month',
  typeFilter: 'all',
  selectedPlan: null,
  search: '',
  scrollTop: 0,
  selectedPayment: null,
  renderSequence: 0,
  hasLoaded: false
};

document.addEventListener('DOMContentLoaded', () => {
  // Check if admin tab finance exists
  if (!document.getElementById('admin-tab-finance')) return;

  initFinanceTab();
});

function initFinanceTab() {
  // Period Switcher Segment Buttons
  const periodBtns = document.querySelectorAll('#finPeriodSegment .admin-segment-btn');
  periodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      periodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      finState.period = btn.dataset.period;
      renderFinanceTab();
    });
  });

  // Search input
  const searchInput = document.getElementById('finSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      finState.search = searchInput.value.trim();
      renderFinanceTab();
    });
  }

  // Type Filter chips
  const chips = document.querySelectorAll('#finFilterChips .chip-btn');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      finState.typeFilter = chip.dataset.finFilter;
      renderFinanceTab();
    });
  });

  // Reset plan filter button
  const btnResetPlan = document.getElementById('btnResetPlanFilter');
  if (btnResetPlan) {
    btnResetPlan.addEventListener('click', () => {
      finState.selectedPlan = null;
      btnResetPlan.classList.add('hidden');
      renderFinanceTab();
    });
  }

  // Modal: Payment Detail Actions
  document.getElementById('btnFinPayDetailClose').addEventListener('click', () => {
    document.getElementById('modalFinancePaymentDetail').classList.add('hidden');
  });

  document.getElementById('btnFinCopyPaySummary').addEventListener('click', async () => {
    const p = finState.selectedPayment;
    if (!p) return;
    const txt = `Платёж ${p.id}\nПользователь: ${p.name} (${p.username || 'Без username'})\nTG ID: ${p.tgId}\nСумма: ${p.amount} ₽\nТип: ${p.typeLabel}\nТариф: ${p.plan}\nПериод: ${p.period}\nПодтверждён: ${p.fullDate}\nПодтвердил: ${p.admin}`;
    await copyWithFeedback(txt, 'Данные платежа скопированы');
  });

  document.getElementById('btnFinOpenUser').addEventListener('click', () => {
    const p = finState.selectedPayment;
    if (!p) return;

    // Save exact scroll position of Finance Tab before opening user profile
    const tabContainer = document.querySelector('#admin-tab-finance').parentElement;
    if (tabContainer) finState.scrollTop = tabContainer.scrollTop;

    document.getElementById('modalFinancePaymentDetail').classList.add('hidden');
    openUserDetail(p.userId);
  });

  // Modal: Export Trigger & Actions
  const btnOpenExport = document.getElementById('btnOpenExportModal');
  const modalExport = document.getElementById('modalFinanceExport');
  if (btnOpenExport && modalExport) {
    btnOpenExport.addEventListener('click', () => {
      let pLabel = 'Этот месяц (1–30 июля)';
      if (finState.period === 'quarter') pLabel = '3 месяца (Май–Июль)';
      if (finState.period === 'all') pLabel = 'Всё время работы';
      document.getElementById('finExportPeriodLabel').textContent = pLabel;
      modalExport.classList.remove('hidden');
    });
  }

  document.getElementById('btnFinExportCancel').addEventListener('click', () => {
    modalExport.classList.add('hidden');
  });

  document.getElementById('btnFinExportDownload').addEventListener('click', async () => {
    const btn = document.getElementById('btnFinExportDownload');
    btn.textContent = 'Отправка в бот...';
    btn.disabled = true;

    const activeFmt = document.querySelector('#finExportFormatSegment .admin-segment-btn.active');
    const format = activeFmt ? activeFmt.dataset.format : 'csv';

    const useFilters = document.getElementById('finExportUseFilters').checked;

    // The local prototype deliberately does not claim to send anything to Telegram.
    // A protected server export endpoint will create and deliver the real file later.
    await financeApi.exportData({
      period: finState.period,
      format,
      useFilters,
      search: useFilters ? finState.search : '',
      plan: useFilters ? finState.selectedPlan : null
    });

    btn.textContent = 'Подготовить mock';
    btn.disabled = false;
    modalExport.classList.add('hidden');
    showToast(`Mock-отчёт ${format.toUpperCase()} подготовлен. В бот он не отправлялся.`);
  });

  // Export format segment toggle
  const exportFmtBtns = document.querySelectorAll('#finExportFormatSegment .admin-segment-btn');
  exportFmtBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      exportFmtBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Initial render
  renderFinanceTab();
}

async function renderFinanceTab() {
  const requestId = ++finState.renderSequence;
  const status = document.getElementById('finLastUpdatedLabel');
  if (status) status.textContent = finState.hasLoaded ? 'Обновляю mock-данные...' : 'Загружаю mock-данные...';
  try {
    const analytics = await financeApi.getAnalytics(finState.period);
    if (requestId !== finState.renderSequence) return;
    await renderFinanceTabContent(analytics, requestId);
    if (requestId !== finState.renderSequence) return;
    finState.hasLoaded = true;
    if (status) status.textContent = 'Локальные mock-данные';
  } catch (error) {
    if (requestId !== finState.renderSequence) return;
    if (status) status.textContent = finState.hasLoaded ? 'Данные временно устарели' : 'Не удалось загрузить данные';
    showToast('Финансовые данные временно недоступны');
  }
}

async function renderFinanceTabContent(analytics, requestId) {

  // 1. 2x2 Stats Grid
  document.getElementById('finStatRevenue').textContent = `${analytics.revenue.toLocaleString('ru-RU')} ₽`;
  document.getElementById('finStatCount').textContent = analytics.count;
  document.getElementById('finStatAvgCheck').textContent = `${analytics.avgCheck.toLocaleString('ru-RU')} ₽`;
  document.getElementById('finStatPayers').textContent = analytics.uniquePayers;

  // 2. Comparison Block
  const compTitle = document.getElementById('finComparisonTitle');
  const compContent = document.getElementById('finComparisonContent');
  
  if (finState.period === 'month') {
    compTitle.textContent = 'Сравнение дохода';
    compContent.innerHTML = `
      <div class="admin-list-row">
        <span class="admin-list-label">Этот месяц (1–30 июля)</span>
        <span class="admin-list-val" style="font-weight: 700;">${analytics.revenue.toLocaleString('ru-RU')} ₽</span>
      </div>
      <div class="admin-list-row">
        <span class="admin-list-label">Прошлый месяц к этой же дате (1–30 июня)</span>
        <span class="admin-list-val">${analytics.prevRevenue.toLocaleString('ru-RU')} ₽</span>
      </div>
      <div class="admin-list-row">
        <span class="admin-list-label">Изменение</span>
        <span class="admin-list-val pos" style="font-weight: 700;">+${analytics.percentChange}%</span>
      </div>
    `;
  } else if (finState.period === 'quarter') {
    compTitle.textContent = 'Доход по месяцам (3 месяца)';
    let mHtml = '';
    analytics.months.forEach(m => {
      let changeBadge = m.change !== null ? `<span style="font-size:11px; color:var(--lime); margin-left:6px;">+${m.change}%</span>` : '';
      mHtml += `
        <div class="admin-list-row">
          <div>
            <span class="admin-list-label" style="font-weight:600; color:#fff;">${m.name}</span>
            <span style="font-size:11px; color:rgba(255,255,255,0.4); margin-left:8px;">${m.count} оплат</span>
          </div>
          <div>
            <span class="admin-list-val">${m.revenue.toLocaleString('ru-RU')} ₽</span>
            ${changeBadge}
          </div>
        </div>
      `;
    });
    compContent.innerHTML = mHtml;
  } else {
    compTitle.textContent = 'За всё время';
    compContent.innerHTML = `
      <div class="admin-list-row">
        <span class="admin-list-label">Общий доход</span>
        <span class="admin-list-val pos" style="font-size:18px; font-weight:700;">${analytics.totalRevenue.toLocaleString('ru-RU')} ₽</span>
      </div>
      <div class="admin-list-row">
        <span class="admin-list-label">Первая подтверждённая оплата</span>
        <span class="admin-list-val">${analytics.firstPaymentDate}</span>
      </div>
      <div class="admin-list-row">
        <span class="admin-list-label">Лучший месяц</span>
        <span class="admin-list-val" style="color:var(--lime);">${analytics.bestMonth}</span>
      </div>
    `;
  }

  // 3. Income Source Breakdown (Новые vs Продления)
  document.getElementById('finNewSubsSubtext').textContent = `${analytics.newSubs.count} оплат`;
  document.getElementById('finNewSubsVal').textContent = `${analytics.newSubs.amount.toLocaleString('ru-RU')} ₽`;
  document.getElementById('finRenewalsSubtext').textContent = `${analytics.renewals.count} оплат`;
  document.getElementById('finRenewalsVal').textContent = `${analytics.renewals.amount.toLocaleString('ru-RU')} ₽`;

  // 4. Tariff Plan Breakdown
  const plansContainer = document.getElementById('finPlansContainer');
  const plans = document.createDocumentFragment();
  analytics.plans.forEach((pl) => {
    const isSelected = finState.selectedPlan === pl.plan;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `admin-list-row clickable-row ${isSelected ? 'active-filter' : ''}`;
    row.style.cssText = `width:100%;cursor:pointer;padding:10px 12px;border-radius:8px;background:${isSelected ? 'rgba(184,255,0,0.1)' : 'transparent'};border:${isSelected ? '1px solid var(--lime)' : 'none'};text-align:left;`;
    row.addEventListener('click', () => togglePlanFilter(pl.plan));
    const info = document.createElement('div');
    const label = document.createElement('span');
    label.className = 'admin-list-label';
    label.style.cssText = 'font-weight:600;color:#fff;';
    label.textContent = pl.plan;
    const count = document.createElement('span');
    count.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.4);margin-left:6px;';
    count.textContent = `${pl.count} оплат`;
    const amount = document.createElement('span');
    amount.className = 'admin-list-val pos';
    amount.textContent = `${pl.amount.toLocaleString('ru-RU')} ₽`;
    info.append(label, count);
    row.append(info, amount);
    plans.append(row);
  });
  plansContainer.replaceChildren(plans);

  // Render Payments List
  await renderFinancePaymentsList(requestId);
}

function togglePlanFilter(planName) {
  const btnReset = document.getElementById('btnResetPlanFilter');
  if (finState.selectedPlan === planName) {
    finState.selectedPlan = null;
    btnReset.classList.add('hidden');
  } else {
    finState.selectedPlan = planName;
    btnReset.classList.remove('hidden');
    btnReset.textContent = `Тариф: ${planName} ✕`;
  }
  renderFinanceTab();
}

async function renderFinancePaymentsList(requestId = finState.renderSequence) {
  const container = document.getElementById('finPaymentsListContainer');
  if (!container) return;

  const payments = await financeApi.getPayments({
    period: finState.period,
    type: finState.typeFilter,
    plan: finState.selectedPlan,
    search: finState.search
  });
  if (requestId !== finState.renderSequence) return;

  document.getElementById('finPaymentsCountLabel').textContent = `Показано ${payments.length} оплат`;

  if (payments.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;color:rgba(255,255,255,0.4);padding:24px 0;font-size:13px;';
    const text = document.createElement('div');
    text.textContent = 'За этот период подтверждённых оплат нет';
    empty.append(text);
    if (finState.search || finState.selectedPlan) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'chip-btn';
      reset.style.cssText = 'margin-top:8px;font-size:12px;';
      reset.textContent = 'Сбросить фильтры';
      reset.addEventListener('click', resetAllFinFilters);
      empty.append(reset);
    }
    container.replaceChildren(empty);
    return;
  }

  const rows = document.createDocumentFragment();
  payments.forEach((payment) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'user-item-row';
    row.style.cssText = 'width:100%;border:0;background:transparent;text-align:left;cursor:pointer;';
    row.addEventListener('click', () => openFinancePaymentDetail(payment.id));
    const info = document.createElement('div');
    info.className = 'user-item-info';
    const name = document.createElement('div');
    name.className = 'user-item-name';
    name.textContent = payment.name || 'Без имени';
    const identity = document.createElement('div');
    identity.className = 'user-item-subtext';
    identity.textContent = `${payment.username || 'без username'} · ID ${payment.userInternalId || '—'}`;
    const type = document.createElement('div');
    type.className = 'user-item-subtext';
    type.style.cssText = 'color:rgba(255,255,255,0.6);margin-top:2px;';
    type.textContent = `${payment.typeLabel} · ${payment.plan}`;
    info.append(name, identity, type);
    const meta = document.createElement('div');
    meta.style.textAlign = 'right';
    const amount = document.createElement('div');
    amount.style.cssText = 'font-size:15px;font-weight:700;color:var(--lime);';
    amount.textContent = `${payment.amount} ₽`;
    const date = document.createElement('div');
    date.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;';
    date.textContent = payment.date;
    meta.append(amount, date);
    row.append(info, meta);
    rows.append(row);
  });
  container.replaceChildren(rows);
}

function resetAllFinFilters() {
  finState.search = '';
  finState.selectedPlan = null;
  finState.typeFilter = 'all';
  const searchInput = document.getElementById('finSearchInput');
  if (searchInput) searchInput.value = '';
  document.getElementById('btnResetPlanFilter').classList.add('hidden');
  const chips = document.querySelectorAll('#finFilterChips .chip-btn');
  chips.forEach(c => c.classList.toggle('active', c.dataset.finFilter === 'all'));
  renderFinanceTab();
}

async function openFinancePaymentDetail(payId) {
  const payments = await financeApi.getPayments({ period: finState.period, type: 'all' });
  const p = payments.find(x => x.id === payId);
  if (!p) return;

  finState.selectedPayment = p;

  document.getElementById('finPayDetailId').textContent = p.id;
  const content = document.getElementById('finPayDetailContent');
  if (content) {
    content.innerHTML = `
      <div style="font-size: 24px; font-weight: 800; color: var(--lime);">${escapeHtml(p.amount)} ₽</div>
      <div style="font-size: 12px; color: var(--lime); font-weight: 600; margin-bottom: 6px;">Подтверждён</div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span style="color: rgba(255,255,255,0.5);">Пользователь</span>
        <span style="color: #fff; font-weight: 600;">${escapeHtml(p.name)} (${escapeHtml(p.username || 'без username')})</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span style="color: rgba(255,255,255,0.5);">TG ID / ID</span>
        <span style="color: #fff;">${escapeHtml(p.tgId)} · ${escapeHtml(p.userInternalId)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span style="color: rgba(255,255,255,0.5);">Тип оплаты</span>
        <span style="color: #fff;">${escapeHtml(p.typeLabel)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span style="color: rgba(255,255,255,0.5);">Тариф</span>
        <span style="color: #fff;">${escapeHtml(p.plan)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span style="color: rgba(255,255,255,0.5);">Период подписки</span>
        <span style="color: #fff;">${escapeHtml(p.period)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span style="color: rgba(255,255,255,0.5);">Подтверждён</span>
        <span style="color: #fff;">${escapeHtml(p.fullDate)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span style="color: rgba(255,255,255,0.5);">Подтвердил</span>
        <span style="color: #fff;">${escapeHtml(p.admin)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0;">
        <span style="color: rgba(255,255,255,0.5);">Способ оплаты</span>
        <span style="color: #fff;">${escapeHtml(p.method)}</span>
      </div>
    `;
  }

  document.getElementById('modalFinancePaymentDetail').classList.remove('hidden');
}
