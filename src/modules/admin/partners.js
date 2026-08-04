// ----------------------------------------------------
// PARTNERS MODULE (WITH DUAL ADAPTER ARCHITECTURE)
// ----------------------------------------------------

const MOCK_PARTNERS_LIST = [
  {
    id: "p-51092",
    userId: "u-51092",
    name: "Мария",
    username: "@maria_v",
    tgId: "89230194",
    userInternalId: "51092",
    sourceTitle: "Telegram-канал Мария",
    code: "maria-blog",
    status: "active",
    createdAt: "2026-02-18T12:00:00+03:00",
    createdDate: "18 февраля 2026",
    linkUrl: "t.me/ghostlink_bot?start=partner_maria-blog",
    registeredCount: 94,
    paidCount: 36,
    unpaidCount: 58,
    conversion: 38.3,
    initialBonusMonths: 6,
    invitedBonusMonths: 21,
    totalBonusMonths: 27,
    progress: 1, // 36 % 5 = 1
    remaining: 4, // 5 - 1 = 4
    invitedList: [
      { userId: "u-49218", name: "Алексей", username: "@alex_dev", regDate: "12 июля", paidDate: "18 июля · 502 ₽", isPaid: true },
      { userId: "u-38910", name: "Игорь", username: "", regDate: "20 июля", paidDate: "—", isPaid: false }
    ],
    bonusHistory: [
      { date: "30 июля 2026", months: "+3 месяца", reason: "За 35 первых оплат" },
      { date: "12 июня 2026", months: "+3 месяца", reason: "За 30 первых оплат" },
      { date: "18 февраля 2026", months: "+6 месяцев", reason: "Стартовый бонус" }
    ]
  },
  {
    id: "p-10923",
    userId: "u-10923",
    name: "Дмитрий",
    username: "@dmitry_b",
    tgId: "40192834",
    userInternalId: "10923",
    sourceTitle: "YouTube Иван",
    code: "ivan-youtube",
    status: "suspended",
    createdAt: "2026-03-10T12:00:00+03:00",
    createdDate: "10 марта 2026",
    linkUrl: "t.me/ghostlink_bot?start=partner_ivan-youtube",
    registeredCount: 61,
    paidCount: 20,
    unpaidCount: 41,
    conversion: 32.8,
    initialBonusMonths: 6,
    invitedBonusMonths: 12,
    totalBonusMonths: 18,
    progress: 0, // 20 % 5 = 0
    remaining: 5,
    invitedList: [
      { userId: "u-00912", name: "Сергей", username: "@sergey_old", regDate: "15 марта", paidDate: "15 марта · 502 ₽", isPaid: true }
    ],
    bonusHistory: [
      { date: "15 мая 2026", months: "+3 месяца", reason: "За 20 первых оплат" },
      { date: "10 марта 2026", months: "+6 месяцев", reason: "Стартовый бонус" }
    ]
  }
];

const MockPartnersAdapter = {
  getSummary: async () => {
    await new Promise(r => setTimeout(r, 150));
    return getMockPartnersSummary();
  },
  getPartners: async (params) => {
    await new Promise(r => setTimeout(r, 150));
    let result = [...MOCK_PARTNERS_LIST];

    if (params.status && params.status !== 'all') {
      result = result.filter(p => p.status === params.status);
    }
    if (params.progress && params.progress !== 'all') {
      const targetProg = parseInt(params.progress, 10);
      result = result.filter(p => p.progress === targetProg);
    }
    if (params.activity && params.activity !== 'all') {
      if (params.activity === 'no_reg') result = result.filter(p => p.registeredCount === 0);
      if (params.activity === 'no_pay') result = result.filter(p => p.paidCount === 0);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) ||
        p.tgId.includes(q) ||
        p.userInternalId.includes(q) ||
        p.sourceTitle.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
      );
    }
    // Keep every sort option real in the prototype so the future API contract
    // has one clear meaning for each control.
    if (params.sort === 'activity') {
      result.sort((a, b) => (b.paidCount + b.registeredCount) - (a.paidCount + a.registeredCount));
    }
    if (params.sort === 'paid') result.sort((a, b) => b.paidCount - a.paidCount);
    if (params.sort === 'progress') result.sort((a, b) => b.progress - a.progress);
    if (params.sort === 'newest') result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (params.sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name));

    return result;
  },
  getPartner: async (id) => {
    await new Promise(r => setTimeout(r, 100));
    return MOCK_PARTNERS_LIST.find(p => p.id === id || p.userId === id);
  },
  createPartner: async (payload) => {
    requireAdminMockAccess('create_partner');
    await new Promise(r => setTimeout(r, 300));
    const normalizedCode = normalizePartnerCode(payload.code);
    const sourceTitle = normalizePartnerSourceTitle(payload.sourceTitle);
    if (MOCK_PARTNERS_LIST.some(partner => partner.userId === payload.userId)) {
      throw new Error('Этот пользователь уже является партнёром');
    }
    if (MOCK_PARTNERS_LIST.some(partner => partner.code === normalizedCode)) {
      throw new Error('Этот код ссылки уже занят');
    }
    const newPart = {
      id: `p-${payload.userId}`,
      userId: payload.userId,
      name: payload.userName,
      username: payload.userUsername || '',
      tgId: payload.userTgId,
      userInternalId: payload.userInternalId,
      sourceTitle,
      code: normalizedCode,
      status: "active",
      createdAt: new Date().toISOString(),
      createdDate: "Сегодня",
      linkUrl: `t.me/ghostlink_bot?start=partner_${normalizedCode}`,
      registeredCount: 0,
      paidCount: 0,
      unpaidCount: 0,
      conversion: 0,
      initialBonusMonths: 6,
      invitedBonusMonths: 0,
      totalBonusMonths: 6,
      progress: 0,
      remaining: 5,
      invitedList: [],
      bonusHistory: [
        { date: "Сегодня", months: "+6 месяцев", reason: "Стартовый бонус" }
      ]
    };
    MOCK_PARTNERS_LIST.unshift(newPart);
    return newPart;
  },
  updateSource: async (partnerId, newTitle) => {
    requireAdminMockAccess('update_partner_source');
    await new Promise(r => setTimeout(r, 200));
    const p = MOCK_PARTNERS_LIST.find(x => x.id === partnerId);
    if (!p) throw new Error('Партнёр не найден');
    p.sourceTitle = normalizePartnerSourceTitle(newTitle);
    return true;
  },
  updateCode: async (partnerId, newCode) => {
    requireAdminMockAccess('update_partner_code');
    await new Promise(r => setTimeout(r, 200));
    const p = MOCK_PARTNERS_LIST.find(x => x.id === partnerId);
    if (!p) throw new Error('Партнёр не найден');
    const normalizedCode = normalizePartnerCode(newCode);
    if (MOCK_PARTNERS_LIST.some(partner => partner.id !== partnerId && partner.code === normalizedCode)) {
      throw new Error('Этот код ссылки уже занят');
    }
    p.code = normalizedCode;
    p.linkUrl = `t.me/ghostlink_bot?start=partner_${normalizedCode}`;
    return true;
  },
  toggleSuspend: async (partnerId) => {
    requireAdminMockAccess('toggle_partner_suspend');
    await new Promise(r => setTimeout(r, 200));
    const p = MOCK_PARTNERS_LIST.find(x => x.id === partnerId);
    if (!p) throw new Error('Партнёр не найден');
    p.status = p.status === 'active' ? 'suspended' : 'active';
    return p.status;
  }
};

function getMockPartnersSummary() {
  return MOCK_PARTNERS_LIST.reduce((summary, partner) => {
    if (partner.status === 'active') summary.activeCount += 1;
    summary.registeredCount += partner.registeredCount;
    summary.paidCount += partner.paidCount;
    summary.bonusMonthsCount += partner.totalBonusMonths;
    return summary;
  }, { activeCount: 0, registeredCount: 0, paidCount: 0, bonusMonthsCount: 0 });
}

function normalizePartnerCode(value) {
  const normalizedCode = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,40}$/.test(normalizedCode)) {
    throw new Error('Некорректный код ссылки (3-40 символов)');
  }
  return normalizedCode;
}

function normalizePartnerSourceTitle(value) {
  const title = String(value || '').trim();
  if (!title || title.length > 80) {
    throw new Error('Название источника должно содержать от 1 до 80 символов');
  }
  return title;
}

const BackendPartnersAdapter = {
  getSummary: async () => MockPartnersAdapter.getSummary(),
  getPartners: async (params) => MockPartnersAdapter.getPartners(params),
  getPartner: async (id) => MockPartnersAdapter.getPartner(id),
  createPartner: async (payload) => MockPartnersAdapter.createPartner(payload),
  updateSource: async (id, title) => MockPartnersAdapter.updateSource(id, title),
  updateCode: async (id, code) => MockPartnersAdapter.updateCode(id, code),
  toggleSuspend: async (id) => MockPartnersAdapter.toggleSuspend(id)
};

const partnersApi = protectAdminMockAdapter(MockPartnersAdapter);

// State management for Partners Module UI
let partState = {
  status: 'all',
  progress: 'all',
  activity: 'all',
  sort: 'activity',
  search: '',
  scrollTop: 0,
  selectedPartnerId: null,
  selectedPartner: null,
  invitedFilter: 'all',
  addPartSelectedUser: null,
  openedFromPartnerDetailId: null,
  initialized: false,
  summaryRequestId: 0,
  listRequestId: 0,
  detailRequestId: 0,
  searchRequestId: 0,
  isMutating: false,
  hasLoaded: false
};

document.addEventListener('DOMContentLoaded', () => {
  // The local prototype is owner-only. The hosted user Mini App must neither
  // bind these controls nor expose partner mock operations.
  if (!IS_ADMIN || !document.getElementById('admin-tab-partners')) return;
  initPartnersTab();
});

function initPartnersTab() {
  if (partState.initialized) return;
  partState.initialized = true;

  // Search Input
  const searchInput = document.getElementById('partSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      partState.search = searchInput.value.trim();
      renderPartnersList();
    });
  }

  // Status Filter Chips
  const statusChips = document.querySelectorAll('#partStatusChips .chip-btn');
  statusChips.forEach(chip => {
    chip.addEventListener('click', () => {
      statusChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      partState.status = chip.dataset.partStatus;
      renderPartnersList();
    });
  });

  // Toggle Extra Filters Panel
  const btnToggleExtra = document.getElementById('btnTogglePartExtraFilters');
  const extraPanel = document.getElementById('partExtraFiltersPanel');
  if (btnToggleExtra && extraPanel) {
    btnToggleExtra.addEventListener('click', () => {
      extraPanel.classList.toggle('hidden');
    });
  }

  // Progress Chips
  const progChips = document.querySelectorAll('#partProgressChips .chip-btn');
  progChips.forEach(chip => {
    chip.addEventListener('click', () => {
      progChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      partState.progress = chip.dataset.partProg;
      renderPartnersList();
    });
  });

  // Activity Chips
  const actChips = document.querySelectorAll('#partActivityChips .chip-btn');
  actChips.forEach(chip => {
    chip.addEventListener('click', () => {
      actChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      partState.activity = chip.dataset.partAct;
      renderPartnersList();
    });
  });

  // Sort Select
  const sortSelect = document.getElementById('partSortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      partState.sort = sortSelect.value;
      renderPartnersList();
    });
  }

  // Open Add Partner Modal
  const btnOpenAdd = document.getElementById('btnOpenAddPartner');
  if (btnOpenAdd) {
    btnOpenAdd.addEventListener('click', () => {
      openAddPartnerModal();
    });
  }

  // Partner Detail Back Button
  const btnDetailBack = document.getElementById('btnPartnerDetailBack');
  if (btnDetailBack) {
    btnDetailBack.addEventListener('click', () => {
      closeOverlay(document.getElementById('page-partner-detail'));
      // Restore scroll position of Partners Tab
      const tabContainer = document.querySelector('#admin-tab-partners').parentElement;
      if (tabContainer && partState.scrollTop) {
        tabContainer.scrollTop = partState.scrollTop;
      }
    });
  }

  // Partner Detail Menu (•••)
  const btnDetailMenu = document.getElementById('btnPartnerDetailMenu');
  if (btnDetailMenu) {
    btnDetailMenu.addEventListener('click', () => {
      document.getElementById('menuPartnerActions').classList.remove('hidden');
    });
  }

  // Partner Action Menu Handlers
  document.getElementById('btnPartAct_close').addEventListener('click', () => {
    document.getElementById('menuPartnerActions').classList.add('hidden');
  });

  document.getElementById('btnPartAct_copyTgId').addEventListener('click', async () => {
    const p = partState.selectedPartner;
    if (!p) return;
    document.getElementById('menuPartnerActions').classList.add('hidden');
    await copyWithFeedback(p.tgId, 'Telegram ID скопирован');
  });

  document.getElementById('btnPartAct_copySummary').addEventListener('click', async () => {
    const p = partState.selectedPartner;
    if (!p) return;
    const txt = `Партнёр ${p.name} (${p.username || 'без username'})\nTG ID: ${p.tgId}\nИсточник: ${p.sourceTitle}\nСсылка: ${p.linkUrl}\nРегистраций: ${p.registeredCount}\nОплат: ${p.paidCount}\nНачислено: ${p.totalBonusMonths} месяцев`;
    document.getElementById('menuPartnerActions').classList.add('hidden');
    await copyWithFeedback(txt, 'Данные партнёра скопированы');
  });

  document.getElementById('btnPartAct_editSource').addEventListener('click', () => {
    const p = partState.selectedPartner;
    if (!p) return;
    document.getElementById('editPartSourceInput').value = p.sourceTitle;
    document.getElementById('menuPartnerActions').classList.add('hidden');
    document.getElementById('modalEditPartnerSource').classList.remove('hidden');
  });

  document.getElementById('btnPartAct_editCode').addEventListener('click', () => {
    const p = partState.selectedPartner;
    if (!p) return;
    document.getElementById('editPartCodeInput').value = p.code;
    document.getElementById('menuPartnerActions').classList.add('hidden');
    document.getElementById('modalEditPartnerCode').classList.remove('hidden');
  });

  document.getElementById('btnPartAct_toggleSuspend').addEventListener('click', () => {
    const p = partState.selectedPartner;
    if (!p) return;
    document.getElementById('menuPartnerActions').classList.add('hidden');

    const title = document.getElementById('suspendPartModalTitle');
    const desc = document.getElementById('suspendPartModalDesc');
    const submitBtn = document.getElementById('btnSuspendPartSubmit');

    if (p.status === 'active') {
      title.textContent = 'Приостановить партнёра?';
      desc.textContent = 'Новые пользователи больше не будут закрепляться по его партнёрской ссылке. Уже приглашённые пользователи и ранее начисленные месяцы сохранятся.';
      submitBtn.textContent = 'Приостановить';
    } else {
      title.textContent = 'Возобновить партнёра?';
      desc.textContent = 'Партнёрская ссылка снова станет активной для новых регистраций. Дополнительный стартовый бонус повторно не начисляется.';
      submitBtn.textContent = 'Возобновить';
    }

    document.getElementById('modalConfirmSuspendPartner').classList.remove('hidden');
  });

  // Modal: Edit Source Title Actions
  document.getElementById('btnEditPartSourceCancel').addEventListener('click', () => {
    document.getElementById('modalEditPartnerSource').classList.add('hidden');
  });
  document.getElementById('btnEditPartSourceSubmit').addEventListener('click', async () => {
    const p = partState.selectedPartner;
    const newTitle = document.getElementById('editPartSourceInput').value.trim();
    if (!p || !newTitle) return;
    const button = document.getElementById('btnEditPartSourceSubmit');
    await runPartnerMutation(button, 'Сохраняю...', async () => {
      await partnersApi.updateSource(p.id, newTitle);
      document.getElementById('modalEditPartnerSource').classList.add('hidden');
      showToast('Название источника обновлено');
      await Promise.all([openPartnerDetail(p.id), renderPartnersTab()]);
    });
  });

  // Modal: Edit Link Code Actions
  document.getElementById('btnEditPartCodeCancel').addEventListener('click', () => {
    document.getElementById('modalEditPartnerCode').classList.add('hidden');
  });
  document.getElementById('btnEditPartCodeSubmit').addEventListener('click', async () => {
    const p = partState.selectedPartner;
    const newCode = document.getElementById('editPartCodeInput').value.trim().toLowerCase();
    if (!p || !newCode) return;
    if (!/^[a-z0-9_-]{3,40}$/.test(newCode)) {
      showToast('Некорректный формат кода ссылки');
      return;
    }

    const button = document.getElementById('btnEditPartCodeSubmit');
    await runPartnerMutation(button, 'Изменяю...', async () => {
      await partnersApi.updateCode(p.id, newCode);
      document.getElementById('modalEditPartnerCode').classList.add('hidden');
      showToast('Код ссылки изменён');
      await Promise.all([openPartnerDetail(p.id), renderPartnersTab()]);
    });
  });

  // Modal: Suspend/Resume Actions
  document.getElementById('btnSuspendPartCancel').addEventListener('click', () => {
    document.getElementById('modalConfirmSuspendPartner').classList.add('hidden');
  });
  document.getElementById('btnSuspendPartSubmit').addEventListener('click', async () => {
    const p = partState.selectedPartner;
    if (!p) return;

    const button = document.getElementById('btnSuspendPartSubmit');
    await runPartnerMutation(button, 'Сохраняю...', async () => {
      const newStatus = await partnersApi.toggleSuspend(p.id);
      document.getElementById('modalConfirmSuspendPartner').classList.add('hidden');
      showToast(newStatus === 'suspended' ? 'Партнёр приостановлен' : 'Партнёр возобновлён');
      await Promise.all([openPartnerDetail(p.id), renderPartnersTab()]);
    });
  });

  // Partner Detail Links & User Buttons
  document.getElementById('btnPdCopyLink').addEventListener('click', async () => {
    const p = partState.selectedPartner;
    if (!p) return;
    await copyWithFeedback(p.linkUrl, 'Ссылка скопирована');
  });

  document.getElementById('btnPdShareLink').addEventListener('click', () => {
    const p = partState.selectedPartner;
    if (!p) return;
    copyWithFeedback(p.linkUrl, 'Mock-ссылка скопирована. В Telegram она не отправлялась.');
  });

  document.getElementById('btnPdOpenUser').addEventListener('click', () => {
    const p = partState.selectedPartner;
    if (!p) return;
    partState.openedFromPartnerDetailId = p.id;
    openUserDetail(p.userId);
  });

  document.getElementById('btnPdWriteUser').addEventListener('click', () => {
    const p = partState.selectedPartner;
    if (!p) return;
    showToast(`Mock-режим: сообщение для ${p.name} не отправлялось.`);
  });

  // Partner Detail Invited Users Chips
  const invChips = document.querySelectorAll('#pdInvitedFilterChips .chip-btn');
  invChips.forEach(chip => {
    chip.addEventListener('click', () => {
      invChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      partState.invitedFilter = chip.dataset.pdInvFilter;
      renderPartnerDetailInvitedList();
    });
  });

  // Modal: Add Partner Actions
  document.getElementById('btnAddPartCancel').addEventListener('click', () => {
    document.getElementById('modalAddPartner').classList.add('hidden');
  });

  const addPartSearchInput = document.getElementById('addPartSearchUser');
  if (addPartSearchInput) {
    addPartSearchInput.addEventListener('input', async () => {
      const q = addPartSearchInput.value.trim().toLowerCase();
      const resultsContainer = document.getElementById('addPartUserResults');
      const requestId = ++partState.searchRequestId;
      if (!q) { resultsContainer.replaceChildren(); return; }

      try {
        const users = await userApi.getUsers();
        if (requestId !== partState.searchRequestId) return;
        const filtered = users.filter(u =>
          u.name.toLowerCase().includes(q) ||
          (u.username && u.username.toLowerCase().includes(q)) ||
          u.tgId.includes(q) ||
          u.userId.includes(q)
        );
        renderAddPartnerSearchResults(resultsContainer, filtered);
      } catch (error) {
        if (requestId !== partState.searchRequestId) return;
        renderPartnerEmptyState(resultsContainer, 'Не удалось загрузить пользователей');
      }
    });
  }

  document.getElementById('addPartSourceTitle').addEventListener('input', checkAddPartFormValid);
  document.getElementById('addPartLinkCode').addEventListener('input', checkAddPartFormValid);

  document.getElementById('btnAddPartSubmit').addEventListener('click', async () => {
    const u = partState.addPartSelectedUser;
    const sourceTitle = document.getElementById('addPartSourceTitle').value.trim();
    const code = document.getElementById('addPartLinkCode').value.trim().toLowerCase();

    if (!u || !sourceTitle || !code) return;
    if (!/^[a-z0-9_-]{3,40}$/.test(code)) {
      showToast('Некорректный код ссылки (3-40 символов)');
      return;
    }

    const btnSubmit = document.getElementById('btnAddPartSubmit');
    await runPartnerMutation(btnSubmit, 'Создание...', async () => {
      const newPart = await partnersApi.createPartner({
        userId: u.id,
        userName: u.name,
        userUsername: u.username,
        userTgId: u.tgId,
        userInternalId: u.userId,
        sourceTitle: sourceTitle,
        code: code
      });
      document.getElementById('modalAddPartner').classList.add('hidden');
      showToast('Партнёр создан! Начислено 6 месяцев');
      await Promise.all([renderPartnersTab(), openPartnerDetail(newPart.id)]);
    });
  });

  // Initial Render
  renderPartnersTab();
}

async function runPartnerMutation(button, busyText, operation) {
  if (partState.isMutating) return false;
  partState.isMutating = true;
  const originalText = button?.textContent || '';
  if (button) {
    button.disabled = true;
    button.textContent = busyText;
  }

  try {
    await operation();
    return true;
  } catch (error) {
    showToast(error?.message || 'Не удалось выполнить действие');
    return false;
  } finally {
    partState.isMutating = false;
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
    checkAddPartFormValid();
  }
}

function renderPartnerEmptyState(container, message, actionLabel = '', action = null) {
  container.replaceChildren();
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'text-align:center;color:rgba(255,255,255,0.4);padding:30px 0;font-size:13px;';

  const text = document.createElement('div');
  text.textContent = message;
  wrapper.appendChild(text);

  if (actionLabel && action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip-btn';
    button.style.cssText = 'margin-top:8px;font-size:12px;';
    button.textContent = actionLabel;
    button.addEventListener('click', action);
    wrapper.appendChild(button);
  }

  container.appendChild(wrapper);
}

function renderAddPartnerSearchResults(container, users) {
  container.replaceChildren();
  if (users.length === 0) {
    renderPartnerEmptyState(container, 'Пользователи не найдены');
    return;
  }

  users.forEach(user => {
    const row = document.createElement('button');
    row.type = 'button';
    row.style.cssText = 'width:100%;padding:6px 8px;background:rgba(255,255,255,0.05);border:0;border-radius:6px;cursor:pointer;font-size:12px;text-align:left;';

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:600;color:#fff;';
    title.textContent = `${user.name} (${user.username || 'без username'})`;

    const meta = document.createElement('div');
    meta.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.5);';
    meta.textContent = `TG ID: ${user.tgId} · ID: ${user.userId}`;

    row.append(title, meta);
    row.addEventListener('click', () => selectAddPartUser(user.id));
    container.appendChild(row);
  });
}

function openAddPartnerModal() {
  partState.addPartSelectedUser = null;
  document.getElementById('addPartSearchUser').value = '';
  document.getElementById('addPartUserResults').replaceChildren();
  document.getElementById('addPartSourceTitle').value = '';
  document.getElementById('addPartLinkCode').value = '';
  document.getElementById('addPartSelectedUserBox').classList.add('hidden');
  document.getElementById('btnAddPartSubmit').disabled = true;
  document.getElementById('modalAddPartner').classList.remove('hidden');
}

async function selectAddPartUser(userId) {
  const users = await userApi.getUsers();
  const u = users.find(x => x.id === userId);
  if (!u) return;

  partState.addPartSelectedUser = u;
  document.getElementById('addPartUserResults').replaceChildren();
  document.getElementById('addPartSearchUser').value = u.name;

  document.getElementById('addPartSelName').textContent = u.name;
  document.getElementById('addPartSelInfo').textContent = `${u.username || 'Без username'} · TG ID ${u.tgId}`;
  document.getElementById('addPartSelectedUserBox').classList.remove('hidden');

  // Auto fill suggestions
  if (!document.getElementById('addPartSourceTitle').value) {
    document.getElementById('addPartSourceTitle').value = `Партнёр ${u.name}`;
  }
  if (!document.getElementById('addPartLinkCode').value) {
    const suggested = (u.username ? u.username.replace('@', '') : u.name).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    document.getElementById('addPartLinkCode').value = suggested || `partner-${u.userId}`;
  }

  checkAddPartFormValid();
}

function checkAddPartFormValid() {
  const u = partState.addPartSelectedUser;
  const source = document.getElementById('addPartSourceTitle').value.trim();
  const code = document.getElementById('addPartLinkCode').value.trim();
  document.getElementById('btnAddPartSubmit').disabled = !(u && source && code);
}

async function renderPartnersTab() {
  const requestId = ++partState.summaryRequestId;
  try {
    const summary = await partnersApi.getSummary();
    if (requestId !== partState.summaryRequestId) return;
    document.getElementById('partStatActive').textContent = summary.activeCount;
    document.getElementById('partStatRegistered').textContent = summary.registeredCount;
    document.getElementById('partStatPaid').textContent = summary.paidCount;
    document.getElementById('partStatBonusMonths').textContent = `${summary.bonusMonthsCount} мес.`;
  } catch (error) {
    if (requestId === partState.summaryRequestId) showToast('Статистика партнёров временно недоступна');
  }
  await renderPartnersList();
}

async function renderPartnersList() {
  const container = document.getElementById('partListContainer');
  if (!container) return;
  const requestId = ++partState.listRequestId;
  const countLabel = document.getElementById('partCountLabel');
  if (!partState.hasLoaded) renderPartnerEmptyState(container, 'Загружаю партнёров...');

  try {
    const partners = await partnersApi.getPartners({
      status: partState.status,
      progress: partState.progress,
      activity: partState.activity,
      sort: partState.sort,
      search: partState.search
    });
    if (requestId !== partState.listRequestId) return;

    partState.hasLoaded = true;
    countLabel.textContent = `Показано ${partners.length} партнёров`;
    if (partners.length === 0) {
      renderPartnerEmptyState(container, 'Партнёры не найдены', 'Сбросить фильтры', resetPartFilters);
      return;
    }

    container.replaceChildren(...partners.map(createPartnerListRow));
  } catch (error) {
    if (requestId !== partState.listRequestId) return;
    countLabel.textContent = partState.hasLoaded ? 'Данные не обновлены' : 'Список недоступен';
    if (!partState.hasLoaded) {
      renderPartnerEmptyState(container, 'Не удалось загрузить партнёров', 'Повторить', renderPartnersList);
    } else {
      showToast('Список партнёров временно не обновился');
    }
  }
}

function createPartnerListRow(partner) {
  const isSuspended = partner.status === 'suspended';
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'user-item-row';
  row.style.cssText = `width:100%;appearance:none;-webkit-appearance:none;background:transparent;color:inherit;font:inherit;border:0;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;padding:10px 12px;text-align:left;${isSuspended ? 'opacity:0.7;' : ''}`;

  const identity = document.createElement('div');
  identity.style.cssText = 'display:flex;align-items:center;gap:10px;flex:1;min-width:0;';
  const dot = document.createElement('span');
  dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${isSuspended ? 'rgba(255,255,255,0.3)' : 'var(--lime)'};flex-shrink:0;`;
  const copy = document.createElement('div');
  copy.style.minWidth = '0';
  const name = document.createElement('div');
  name.style.cssText = 'font-size:14px;font-weight:700;color:#fff;';
  name.textContent = partner.name;
  const source = document.createElement('div');
  source.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.5);';
  source.textContent = `${partner.username || 'без username'} · ${partner.sourceTitle}`;
  const metrics = document.createElement('div');
  metrics.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.6);margin-top:3px;';
  metrics.textContent = `${partner.registeredCount} регистраций · ${partner.paidCount} впервые оплатили`;
  copy.append(name, source, metrics);
  identity.append(dot, copy);

  const progress = document.createElement('div');
  progress.style.cssText = 'text-align:right;min-width:90px;';
  if (isSuspended) {
    progress.textContent = 'Приостановлен';
    progress.style.color = 'rgba(255,255,255,0.4)';
    progress.style.fontSize = '11px';
  } else {
    const label = document.createElement('div');
    label.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.5);';
    label.textContent = 'До бонуса';
    const value = document.createElement('div');
    value.style.cssText = 'font-size:13px;font-weight:700;color:var(--lime);';
    value.textContent = `${partner.progress} / 5`;
    const track = document.createElement('div');
    track.style.cssText = 'width:60px;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;margin-left:auto;margin-top:3px;overflow:hidden;';
    const fill = document.createElement('div');
    fill.style.cssText = `width:${Math.max(0, Math.min(100, (partner.progress / 5) * 100))}%;height:100%;background:var(--lime);`;
    track.appendChild(fill);
    progress.append(label, value, track);
  }

  row.append(identity, progress);
  row.addEventListener('click', () => openPartnerDetail(partner.id));
  return row;
}

function resetPartFilters() {
  partState.search = '';
  partState.status = 'all';
  partState.progress = 'all';
  partState.activity = 'all';
  partState.sort = 'activity';

  const searchInput = document.getElementById('partSearchInput');
  if (searchInput) searchInput.value = '';

  const sortSelect = document.getElementById('partSortSelect');
  if (sortSelect) sortSelect.value = 'activity';

  const statusChips = document.querySelectorAll('#partStatusChips .chip-btn');
  statusChips.forEach(c => c.classList.toggle('active', c.dataset.partStatus === 'all'));

  const progChips = document.querySelectorAll('#partProgressChips .chip-btn');
  progChips.forEach(c => c.classList.toggle('active', c.dataset.partProg === 'all'));

  const actChips = document.querySelectorAll('#partActivityChips .chip-btn');
  actChips.forEach(c => c.classList.toggle('active', c.dataset.partAct === 'all'));

  renderPartnersTab();
}

async function openPartnerDetail(partnerId) {
  // Save scroll position of main partners tab
  const tabContainer = document.querySelector('#admin-tab-partners')?.parentElement;
  if (tabContainer) partState.scrollTop = tabContainer.scrollTop;

  const requestId = ++partState.detailRequestId;
  let p;
  try {
    p = await partnersApi.getPartner(partnerId);
  } catch (error) {
    if (requestId === partState.detailRequestId) showToast('Не удалось открыть партнёра');
    return;
  }
  if (requestId !== partState.detailRequestId) return;
  if (!p) {
    showToast('Партнёр не найден');
    return;
  }

  partState.selectedPartnerId = p.id;
  partState.selectedPartner = p;

  // Header & Identity
  document.getElementById('pdName').textContent = p.name;
  document.getElementById('pdUsername').textContent = p.username || 'без username';
  document.getElementById('pdSourceTitle').textContent = p.sourceTitle;

  const badge = document.getElementById('pdStatusBadge');
  if (badge) {
    if (p.status === 'active') {
      badge.textContent = 'Активный партнёр';
      badge.className = 'user-status-badge';
    } else {
      badge.textContent = 'Приостановлен';
      badge.className = 'user-status-badge nosub';
    }
  }
  const toggleButton = document.getElementById('btnPartAct_toggleSuspend');
  if (toggleButton) {
    toggleButton.textContent = p.status === 'active' ? 'Приостановить партнёра' : 'Возобновить партнёра';
  }

  // Link Block
  document.getElementById('pdLinkTitle').textContent = p.sourceTitle;
  document.getElementById('pdLinkUrl').textContent = p.linkUrl;
  document.getElementById('pdLinkCreatedDate').textContent = `Создана ${p.createdDate}`;
  
  const notice = document.getElementById('pdLinkSuspendedNotice');
  if (notice) notice.classList.toggle('hidden', p.status === 'active');

  // Results Grid
  document.getElementById('pdResRegistered').textContent = p.registeredCount;
  document.getElementById('pdResPaid').textContent = p.paidCount;
  document.getElementById('pdResUnpaid').textContent = p.unpaidCount;
  document.getElementById('pdResConversion').textContent = `${p.conversion}%`;

  // Bonuses Summary
  document.getElementById('pdBonusInvitedVal').textContent = `+${p.invitedBonusMonths} месяцев`;
  document.getElementById('pdBonusTotalVal').textContent = `${p.totalBonusMonths} месяцев`;

  // Progress to Next Bonus
  document.getElementById('pdProgText').textContent = `${p.progress} из 5 первых оплат`;
  document.getElementById('pdProgRemaining').textContent = p.remaining > 0 ? `Осталось ${p.remaining}` : 'Новая группа';
  document.getElementById('pdProgBar').style.width = `${(p.progress / 5) * 100}%`;

  // Render Invited Users
  renderPartnerDetailInvitedList();

  // Render Bonus History Log
  const histContainer = document.getElementById('pdBonusHistoryContainer');
  if (histContainer) {
    const history = Array.isArray(p.bonusHistory) ? p.bonusHistory : [];
    if (history.length === 0) {
      renderPartnerEmptyState(histContainer, 'История начислений пуста');
    } else {
      histContainer.replaceChildren(...history.map(createPartnerBonusHistoryRow));
    }
  }

  // Open Overlay
  openOverlay(document.getElementById('page-partner-detail'));
}

function createPartnerBonusHistoryRow(entry) {
  const row = document.createElement('div');
  row.style.cssText = 'padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center;';
  const copy = document.createElement('div');
  const months = document.createElement('div');
  months.style.cssText = 'font-size:13px;font-weight:700;color:#fff;';
  months.textContent = entry.months;
  const reason = document.createElement('div');
  reason.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.5);';
  reason.textContent = entry.reason;
  const date = document.createElement('div');
  date.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.4);';
  date.textContent = entry.date;
  copy.append(months, reason);
  row.append(copy, date);
  return row;
}

function renderPartnerDetailInvitedList() {
  const container = document.getElementById('pdInvitedUsersListContainer');
  if (!container || !partState.selectedPartner) return;

  const p = partState.selectedPartner;
  let list = p.invitedList || [];

  if (partState.invitedFilter === 'paid') list = list.filter(x => x.isPaid);
  if (partState.invitedFilter === 'unpaid') list = list.filter(x => !x.isPaid);

  if (list.length === 0) {
    renderPartnerEmptyState(container, 'Список приглашённых пуст');
    return;
  }

  container.replaceChildren(...list.map(createPartnerInvitedUserRow));
}

function createPartnerInvitedUserRow(invitedUser) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'user-item-row';
  row.style.cssText = 'width:100%;appearance:none;-webkit-appearance:none;background:transparent;color:inherit;font:inherit;border:0;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;padding:8px 10px;text-align:left;';

  const identity = document.createElement('div');
  const name = document.createElement('div');
  name.style.cssText = 'font-size:13px;font-weight:600;color:#fff;';
  name.textContent = invitedUser.name;
  const username = document.createElement('div');
  username.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.5);';
  username.textContent = invitedUser.username || 'без username';
  const registered = document.createElement('div');
  registered.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px;';
  registered.textContent = `Регистрация: ${invitedUser.regDate}`;
  identity.append(name, username, registered);

  const payment = document.createElement('div');
  payment.style.textAlign = 'right';
  const paymentLabel = document.createElement('div');
  paymentLabel.style.cssText = `font-size:11px;font-weight:600;color:${invitedUser.isPaid ? 'var(--lime)' : 'rgba(255,255,255,0.4)'};`;
  paymentLabel.textContent = invitedUser.isPaid ? 'Первая оплата:' : 'Первая оплата не подтверждена';
  const paymentDate = document.createElement('div');
  paymentDate.style.cssText = `font-size:11px;color:${invitedUser.isPaid ? '#fff' : 'rgba(255,255,255,0.4)'};`;
  paymentDate.textContent = invitedUser.paidDate;
  payment.append(paymentLabel, paymentDate);

  row.append(identity, payment);
  row.addEventListener('click', () => openInvitedUserFromPartner(invitedUser.userId));
  return row;
}

function openInvitedUserFromPartner(userId) {
  partState.openedFromPartnerDetailId = partState.selectedPartnerId;
  openUserDetail(userId);
}
