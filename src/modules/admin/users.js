// ----------------------------------------------------
// USERS MANAGEMENT MODULE (WITH USER_API BACKEND ADAPTER)
// ----------------------------------------------------

const INITIAL_MOCK_USERS = [
  {
    id: "u-49218",
    name: "Алексей",
    username: "@alex_dev",
    tgId: "312826672",
    userId: "49218",
    status: "active", // active | expiring | nosub | blocked | deleted
    subStatusText: "Подписка активна",
    plan: "Solo Ghost",
    expiryDate: "2026-08-12",
    devicesLimit: 3,
    devices: [
      { id: "d-101", name: "iPhone 15 Pro", app: "Karing", status: "active", disableReason: null, lastSeen: "сегодня, 13:21", mockRef: "mock-device-record-d101" },
      { id: "d-102", name: "Windows PC", app: "Karing", status: "active", disableReason: null, lastSeen: "28 июля", mockRef: "mock-device-record-d102" }
    ],
    lastPay: "502 ₽ · 30 июля",
    totalPay: "12 оплат · 6 480 ₽",
    paymentsList: [
      { date: "30 июля 2026, 13:45", amount: "502 ₽", status: "Подтверждено", statusColor: "var(--lime)", desc: "Продление на 3 месяца", sender: "Алексей П.", admin: "Артемий" },
      { date: "12 апреля 2026, 11:20", amount: "430 ₽", status: "Подтверждено", statusColor: "var(--lime)", desc: "Новая подписка", sender: "Алексей П.", admin: "Артемий" },
      { date: "10 апреля 2026, 09:15", amount: "430 ₽", status: "Отклонено", statusColor: "#FF3B30", desc: "Неверная сумма чека", sender: "Алексей П.", admin: "Артемий" }
    ],
    note: "Постоянный клиент. В июле выдали 14 бонусных дней.",
    history: [
      { date: "Сегодня, 13:45", text: "Настройки ключа Windows PC обновлены", admin: "Артемий" },
      { date: "Сегодня, 12:18", text: "Подписка продлена на 3 месяца", admin: "Артемий" },
      { date: "30 июля", text: "Подтверждён платёж 502 ₽", admin: "Артемий" },
      { date: "18 июля", text: "Добавлено устройство iPhone 15 Pro", admin: "Артемий" }
    ],
    referral: {
      count: 3,
      bonusDays: 42,
      invitedList: [
        { name: "Мария", status: "Первая подписка оплачена", bonus: "+14 дней", color: "var(--lime)" },
        { name: "Иван", status: "Пробный период", bonus: "Бонус ещё не начислен", color: "#FF9500" },
        { name: "Дмитрий", status: "Не оплатил подписку", bonus: "Бонус не начислен", color: "rgba(255,255,255,0.4)" }
      ]
    },
    regSource: {
      type: "partner",
      title: "Партнёрская ссылка · YouTube Иван",
      regDate: "18 июля 2026",
      firstPayDate: "30 июля 2026",
      inviterUserId: "u-51092"
    },
    partnerProgram: null
  },
  {
    id: "u-51092",
    name: "Мария",
    username: "@maria_v",
    tgId: "89230194",
    userId: "51092",
    status: "expiring",
    subStatusText: "Истекает 1 августа",
    pendingPay: true,
    plan: "Solo Ghost",
    expiryDate: "2026-08-01",
    devicesLimit: 2,
    devices: [
      { id: "d-103", name: "iPad Air", app: "INCY", status: "active", disableReason: null, lastSeen: "вчера, 19:40", mockRef: "mock-device-record-d103" }
    ],
    lastPay: "502 ₽ · 1 июля",
    totalPay: "3 оплаты · 1 506 ₽",
    note: "",
    history: [
      { date: "1 июля", text: "Подтверждён платёж 502 ₽", admin: "Артемий" }
    ],
    referral: {
      count: 1,
      bonusDays: 14,
      invitedList: [
        { name: "Ольга", status: "Первая подписка оплачена", bonus: "+14 дней", color: "var(--lime)" }
      ]
    },
    regSource: {
      type: "referral",
      title: "Реферальная ссылка · Алексей (@alex_dev)",
      regDate: "1 июля 2026",
      firstPayDate: "1 июля 2026",
      bonusStatus: "Да (+14 дней)",
      inviterUserId: "u-49218"
    },
    partnerProgram: {
      isPartner: true,
      statusText: "Активный партнёр",
      invitedCount: 94,
      paidCount: 36,
      nextBonusProgress: "1 / 5 оплат",
      totalBonusMonths: "24 месяца"
    }
  },
  {
    id: "u-38910",
    name: "Игорь",
    username: "",
    tgId: "19284012",
    userId: "38910",
    status: "nosub",
    subStatusText: "Подписка истекла",
    plan: "Solo Ghost",
    expiryDate: "2026-07-20",
    devicesLimit: 2,
    devices: [
      { id: "d-104", name: "MacBook Pro", app: "Karing", status: "disabled", disableReason: "subscription_disabled", lastSeen: "20 июля", mockRef: "mock-device-record-d104" }
    ],
    lastPay: "502 ₽ · 20 июня",
    totalPay: "1 оплата · 502 ₽",
    note: "Запрашивал помощь по настройке INCY.",
    history: [
      { date: "20 июля", text: "Подписка истекла", admin: "Система" }
    ],
    referral: null,
    regSource: null, // Source unknown / untracked -> block hidden!
    partnerProgram: null
  },
  {
    id: "u-10923",
    name: "Дмитрий",
    username: "@dmitry_b",
    tgId: "40192834",
    userId: "10923",
    status: "blocked",
    subStatusText: "Заблокирован",
    blockReason: "Мультиаккаунт и рассылка ключей",
    plan: "Pro Ghost",
    expiryDate: "2026-06-01",
    devicesLimit: 5,
    devices: [],
    lastPay: "1 200 ₽ · 1 мая",
    totalPay: "2 оплаты · 2 400 ₽",
    note: "Заблокирован по жалобе 15 июня.",
    history: [
      { date: "15 июня", text: "Заблокирован: Мультиаккаунт", admin: "Артемий" }
    ],
    referral: null,
    regSource: { type: "ads", title: "Telegram Ads", regDate: "1 мая 2026", firstPayDate: "1 мая 2026" },
    partnerProgram: null
  },
  {
    id: "u-00912",
    name: "Сергей",
    username: "@sergey_old",
    tgId: "9918237",
    userId: "00912",
    status: "deleted",
    subStatusText: "Удалён",
    plan: "Solo Ghost",
    expiryDate: "2026-01-01",
    devicesLimit: 1,
    devices: [],
    lastPay: "502 ₽ · 1 декабря 2025",
    totalPay: "1 оплата · 502 ₽",
    note: "Аккаунт переведён в мягкое удаление.",
    history: [
      { date: "15 января 2026", text: "Переведен в статус Удален", admin: "Артемий" }
    ],
    referral: null,
    regSource: null,
    partnerProgram: null
  }
];

function sanitizeMockUsers(users) {
  return (Array.isArray(users) ? users : []).map((user) => ({
    ...user,
    devices: (Array.isArray(user.devices) ? user.devices : []).map((device) => {
      const safeDevice = { ...device };
      // Earlier local previews persisted a field named key. Remove it during
      // every read so an old browser cache cannot become a credential pattern.
      delete safeDevice.key;
      delete safeDevice.token;
      delete safeDevice.setupToken;
      safeDevice.mockRef = typeof safeDevice.mockRef === 'string'
        ? safeDevice.mockRef
        : `mock-device-record-${safeDevice.id || 'unknown'}`;
      return safeDevice;
    }),
  }));
}

// Local persistence contains only mock user metadata and opaque device ids.
const rawUserApi = {
  getUsers: async () => {
    let saved = null;
    try { saved = localStorage.getItem('ghostlink_mock_users_v6'); } catch {}
    if (saved) {
      try {
        const sanitized = sanitizeMockUsers(JSON.parse(saved));
        localStorage.setItem('ghostlink_mock_users_v6', JSON.stringify(sanitized));
        return sanitized;
      } catch {}
    }
    const initial = sanitizeMockUsers(INITIAL_MOCK_USERS);
    try { localStorage.setItem('ghostlink_mock_users_v6', JSON.stringify(initial)); } catch {}
    return initial;
  },
  saveUsers: async (users) => {
    const sanitized = sanitizeMockUsers(users);
    try { localStorage.setItem('ghostlink_mock_users_v6', JSON.stringify(sanitized)); } catch {}
  },
  // Simulates server call with loading state
  request: async (fn) => {
    requireAdminMockAccess('mutate_user');
    await new Promise(r => setTimeout(r, 250)); // simulate 250ms network delay
    const users = await rawUserApi.getUsers();
    const result = fn(users);
    await rawUserApi.saveUsers(users);
    return result;
  }
};
const userApi = protectAdminMockAdapter(rawUserApi);

let currentUsers = [];
let selectedUserId = null;
let selectedDeviceId = null;
let currentFilter = 'all';
let editStepperVal = 3;

// List state preservation object
let savedListState = {
  search: '',
  activeFilter: 'all',
  sort: 'newest',
  scrollTop: 0
};

document.addEventListener('DOMContentLoaded', async () => {
  // The complete user-management prototype belongs to the separate admin
  // build. Never bind its handlers in the public user Mini App.
  if (!IS_ADMIN) return;

  currentUsers = await userApi.getUsers();
  renderUsersList();

  // Search input
  const searchInput = document.getElementById('usersSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      savedListState.search = searchInput.value;
      renderUsersList();
    });
  }

  // Filter chips
  const chips = document.querySelectorAll('#usersFilterChips .chip-btn');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      savedListState.activeFilter = currentFilter;
      renderUsersList();
    });
  });

  // Sort select
  const sortSelect = document.getElementById('usersSortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      savedListState.sort = sortSelect.value;
      renderUsersList();
    });
  }

  // User detail BACK BUTTON (Restores exact list state & scroll position!)
  const btnUserDetailBack = document.getElementById('btnUserDetailBack');
  const pageUserDetail = document.getElementById('page-user-detail');
  if (btnUserDetailBack && pageUserDetail) {
    btnUserDetailBack.addEventListener('click', () => {
      closeOverlay(pageUserDetail);
      // Restore search, filter, sort, then scroll
      if (searchInput) searchInput.value = savedListState.search;
      if (sortSelect) sortSelect.value = savedListState.sort;
      currentFilter = savedListState.activeFilter;
      chips.forEach(c => c.classList.toggle('active', c.dataset.filter === currentFilter));
      
      renderUsersList();
      const tabContainer = document.querySelector('#admin-tab-users').parentElement;
      if (tabContainer) tabContainer.scrollTop = savedListState.scrollTop;
    });
  }

  // Profile Header Menu (•••) Trigger & Actions
  const btnUserDetailMenu = document.getElementById('btnUserDetailMenu');
  const menuUserProfileActions = document.getElementById('menuUserProfileActions');
  if (btnUserDetailMenu && menuUserProfileActions) {
    btnUserDetailMenu.addEventListener('click', () => {
      menuUserProfileActions.classList.remove('hidden');
    });
  }
  document.getElementById('btnProfAction_close').addEventListener('click', () => {
    menuUserProfileActions.classList.add('hidden');
  });

  document.getElementById('btnProfAction_copyTgId').addEventListener('click', async () => {
    const u = currentUsers.find(x => x.id === selectedUserId);
    if (u) {
      menuUserProfileActions.classList.add('hidden');
      await copyWithFeedback(u.tgId, 'Telegram ID скопирован');
    }
  });

  document.getElementById('btnProfAction_copyUserId').addEventListener('click', async () => {
    const u = currentUsers.find(x => x.id === selectedUserId);
    if (u) {
      menuUserProfileActions.classList.add('hidden');
      await copyWithFeedback(u.userId, 'ID пользователя скопирован');
    }
  });

  document.getElementById('btnProfAction_copySummary').addEventListener('click', async () => {
    const u = currentUsers.find(x => x.id === selectedUserId);
    if (u) {
      const summary = `${u.name}\n${u.username || 'Без username'}\nTelegram ID: ${u.tgId}\nID пользователя: ${u.userId}\nТариф: ${u.plan}\nПодписка до: ${formatDateRu(u.expiryDate)}\nУстройств: ${u.devices.length} из ${u.devicesLimit}\nСтатус: ${u.status}`;
      menuUserProfileActions.classList.add('hidden');
      await copyWithFeedback(summary, 'Данные пользователя скопированы');
    }
  });

  document.getElementById('btnProfAction_openTg').addEventListener('click', () => {
    menuUserProfileActions.classList.add('hidden');
    handleOpenTelegramChat();
  });

  document.getElementById('btnProfAction_refreshData').addEventListener('click', async () => {
    const btn = document.getElementById('btnProfAction_refreshData');
    btn.textContent = 'Сохранение...';
    await userApi.request(users => {
      // Re-read users
    });
    btn.textContent = 'Обновить данные';
    menuUserProfileActions.classList.add('hidden');
    showToast('Данные пользователя обновлены');
    openUserDetail(selectedUserId);
  });

  // Contact Telegram Button (`💬 Написать в Telegram`)
  const btnUdContactTg = document.getElementById('btnUdContactTg');
  if (btnUdContactTg) {
    btnUdContactTg.addEventListener('click', () => {
      handleOpenTelegramChat();
    });
  }

  // Fallback No Username Contact Modal buttons
  document.getElementById('btnNoUserClose').addEventListener('click', () => {
    document.getElementById('modalNoUsernameContact').classList.add('hidden');
  });
  document.getElementById('btnNoUserCopyId').addEventListener('click', async () => {
    const u = currentUsers.find(x => x.id === selectedUserId);
    if (u) {
      document.getElementById('modalNoUsernameContact').classList.add('hidden');
      await copyWithFeedback(u.tgId, 'Telegram ID скопирован');
    }
  });
  document.getElementById('btnNoUserSendBot').addEventListener('click', () => {
    document.getElementById('modalNoUsernameContact').classList.add('hidden');
    const u = currentUsers.find(x => x.id === selectedUserId);
    if (u) {
      document.getElementById('sendBotTargetLabel').textContent = `Получатель: ${u.name} · TG ID ${u.tgId}`;
      document.getElementById('msgBotTextarea').value = '';
      document.getElementById('modalSendMessageBot').classList.remove('hidden');
    }
  });

  // Send Message via Bot Modal
  document.getElementById('btnMsgBotCancel').addEventListener('click', () => {
    document.getElementById('modalSendMessageBot').classList.add('hidden');
  });
  document.getElementById('btnMsgBotSend').addEventListener('click', async () => {
    const txt = document.getElementById('msgBotTextarea').value.trim();
    if (!txt) { showToast('Введите сообщение'); return; }
    
    const btn = document.getElementById('btnMsgBotSend');
    btn.textContent = 'Сохранение...';
    btn.disabled = true;

    await userApi.request(users => {
      const u = users.find(x => x.id === selectedUserId);
      if (u) {
        u.history.unshift({ date: 'Сегодня', text: `Сообщение от бота: "${txt.substring(0, 30)}..."`, admin: 'Артемий' });
      }
    });

    btn.textContent = 'Отправить';
    btn.disabled = false;
    document.getElementById('modalSendMessageBot').classList.add('hidden');
    showToast('Сообщение отправлено');
    openUserDetail(selectedUserId);
  });

  // Add User Modal Trigger & Action
  const btnAdminAddUser = document.getElementById('btnAdminAddUser');
  const modalAddUser = document.getElementById('modalAddUser');
  if (btnAdminAddUser && modalAddUser) {
    btnAdminAddUser.addEventListener('click', () => { modalAddUser.classList.remove('hidden'); });
  }
  document.getElementById('btnModalAddU_cancel').addEventListener('click', () => { modalAddUser.classList.add('hidden'); });

  document.getElementById('btnModalAddU_confirm').addEventListener('click', async () => {
    const tgId = document.getElementById('addU_tgId').value.trim();
    const name = document.getElementById('addU_name').value.trim();
    if (!tgId || !name) { showToast('Заполните обязательные поля'); return; }
    if (currentUsers.some((user) => user.tgId === tgId)) {
      showToast('Пользователь с таким Telegram ID уже есть в списке');
      return;
    }

    const btn = document.getElementById('btnModalAddU_confirm');
    btn.textContent = 'Сохранение...';
    btn.disabled = true;

    await userApi.request(users => {
      users.unshift({
        id: 'u-' + Math.floor(Math.random()*90000 + 10000),
        name: name,
        username: document.getElementById('addU_username').value.trim() || '',
        tgId: tgId,
        userId: Math.floor(Math.random()*90000 + 10000).toString(),
        status: 'active',
        subStatusText: 'Подписка активна',
        plan: document.getElementById('addU_plan').value,
        expiryDate: '2026-08-30',
        devicesLimit: parseInt(document.getElementById('addU_devices').value) || 3,
        devices: [],
        lastPay: 'Оплата не зафиксирована',
        totalPay: '0 оплат',
        note: 'Доступ выдан вручную администратором.',
        history: [{ date: 'Сегодня', text: 'Доступ выдан вручную администратором', admin: 'Артемий' }],
        referral: null,
        partner: null
      });
    });

    currentUsers = await userApi.getUsers();
    btn.textContent = 'Создать';
    btn.disabled = false;
    modalAddUser.classList.add('hidden');
    showToast('Пользователь создан!');
    renderUsersList();
  });

  // Payment History Button & Modals
  const btnUdPayHistory = document.getElementById('btnUdPayHistory');
  const modalPaymentHistory = document.getElementById('modalPaymentHistory');
  if (btnUdPayHistory && modalPaymentHistory) {
    btnUdPayHistory.addEventListener('click', () => {
      const u = currentUsers.find(x => x.id === selectedUserId);
      if (!u) return;

      document.getElementById('payHistoryTitle').textContent = `История оплат — ${u.name}`;
      const container = document.getElementById('payHistoryContainer');
      const list = u.paymentsList || [
        { date: u.lastPay ? u.lastPay.split('·')[1] || 'Ранее' : 'Ранее', amount: u.lastPay ? u.lastPay.split('·')[0] || '—' : '—', status: 'Подтверждено', statusColor: 'var(--lime)', desc: 'Оплата подписки', sender: u.name, admin: 'Артемий' }
      ];

      let html = '';
      list.forEach((p) => {
        html += `
          <div style="padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 14px; font-weight: 700; color: #fff;">${p.amount}</span>
              <span style="font-size: 11px; font-weight: 600; color: ${p.statusColor || 'var(--lime)'};">${p.status}</span>
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 4px;">${p.desc}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px;">${p.date}</div>
          </div>
        `;
      });
      container.innerHTML = html;
      modalPaymentHistory.classList.remove('hidden');
    });
  }

  document.getElementById('btnPayHistoryClose').addEventListener('click', () => {
    document.getElementById('modalPaymentHistory').classList.add('hidden');
  });

  // Invited Users List Modal
  const btnUdViewInvited = document.getElementById('btnUdViewInvited');
  const modalInvitedUsersList = document.getElementById('modalInvitedUsersList');
  if (btnUdViewInvited && modalInvitedUsersList) {
    btnUdViewInvited.addEventListener('click', () => {
      const u = currentUsers.find(x => x.id === selectedUserId);
      if (!u || !u.referral) return;

      document.getElementById('invitedUsersTitle').textContent = `Приглашённые — ${u.name}`;
      const container = document.getElementById('invitedUsersContainer');
      const list = u.referral.invitedList || [];

      if (list.length === 0) {
        container.innerHTML = `<div style="font-size:13px; color:rgba(255,255,255,0.4); text-align:center; padding:12px 0;">Список приглашённых пуст</div>`;
      } else {
        let html = '';
        list.forEach(inv => {
          html += `
            <div style="padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 600; color: #fff; font-size: 14px;">${inv.name}</div>
                <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 2px;">${inv.status}</div>
              </div>
              <div style="font-size: 12px; font-weight: 700; color: ${inv.color || 'var(--lime)'};">${inv.bonus}</div>
            </div>
          `;
        });
        container.innerHTML = html;
      }
      modalInvitedUsersList.classList.remove('hidden');
    });
  }

  document.getElementById('btnInvitedUsersClose').addEventListener('click', () => {
    document.getElementById('modalInvitedUsersList').classList.add('hidden');
  });

  // Open Partner / Inviter Profile Button
  const btnUdOpenPartner = document.getElementById('btnUdOpenPartner');
  if (btnUdOpenPartner) {
    btnUdOpenPartner.addEventListener('click', () => {
      const u = currentUsers.find(x => x.id === selectedUserId);
      const inviterId = u?.regSource?.inviterUserId || u?.regSource?.partnerUserId;
      if (inviterId) {
        openUserDetail(inviterId);
      } else {
        showToast('Профиль источника не найден');
      }
    });
  }

  // Open Partner Card Button (From Partner Program block)
  const btnUdOpenPartnerCard = document.getElementById('btnUdOpenPartnerCard');
  if (btnUdOpenPartnerCard) {
    btnUdOpenPartnerCard.addEventListener('click', () => {
      showToast('Переход в раздел «Партнёры»');
      const tabPartners = document.querySelector('[data-admin-tab="partners"]');
      if (tabPartners) tabPartners.click();
    });
  }

  // Extend Subscription Modal & Math
  const btnUdExtendSub = document.getElementById('btnUdExtendSub');
  const modalExtendSub = document.getElementById('modalExtendSub');
  if (btnUdExtendSub && modalExtendSub) {
    btnUdExtendSub.addEventListener('click', () => {
      const u = currentUsers.find(x => x.id === selectedUserId);
      if (!u) return;
      document.getElementById('extendCurrentDateLabel').textContent = `Текущее окончание: ${formatDateRu(u.expiryDate)}`;
      updateExtendPreview(u, 1);
      modalExtendSub.classList.remove('hidden');
    });
  }

  const extendSegBtns = document.querySelectorAll('#extendDurationSegment .admin-segment-btn');
  extendSegBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      extendSegBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const u = currentUsers.find(x => x.id === selectedUserId);
      if (u) updateExtendPreview(u, parseInt(btn.dataset.months));
    });
  });

  document.getElementById('btnModalExtend_cancel').addEventListener('click', () => {
    modalExtendSub.classList.add('hidden');
  });

  document.getElementById('btnModalExtend_confirm').addEventListener('click', async () => {
    const activeSeg = document.querySelector('#extendDurationSegment .admin-segment-btn.active');
    const months = parseInt(activeSeg.dataset.months) || 1;
    const btn = document.getElementById('btnModalExtend_confirm');
    btn.textContent = 'Сохранение...';
    btn.disabled = true;

    await userApi.request(users => {
      const u = users.find(x => x.id === selectedUserId);
      if (u) {
        let baseDate = new Date();
        const expDate = new Date(u.expiryDate);
        if (expDate > baseDate) baseDate = expDate;
        baseDate.setMonth(baseDate.getMonth() + months);
        const newExpiry = baseDate.toISOString().split('T')[0];
        u.expiryDate = newExpiry;
        u.status = 'active';
        u.subStatusText = 'Подписка активна';
        u.history.unshift({ date: 'Сегодня', text: `Подписка продлена на ${months} мес. Новая дата: ${formatDateRu(newExpiry)}`, admin: 'Артемий' });
      }
    });

    currentUsers = await userApi.getUsers();
    btn.textContent = 'Продлить';
    btn.disabled = false;
    modalExtendSub.classList.add('hidden');
    showToast(`Подписка продлена на ${months} мес.`);
    openUserDetail(selectedUserId);
    renderUsersList();
  });

  // Edit Subscription Detailed Modal
  const btnUdEditSub = document.getElementById('btnUdEditSub');
  const modalEditSub = document.getElementById('modalEditSubscriptionDetailed');
  if (btnUdEditSub && modalEditSub) {
    btnUdEditSub.addEventListener('click', () => {
      const u = currentUsers.find(x => x.id === selectedUserId);
      if (!u) return;
      document.getElementById('editSub_plan').value = u.plan;
      document.getElementById('editSub_date').value = u.expiryDate;
      editStepperVal = u.devicesLimit;
      document.getElementById('stepperVal').textContent = editStepperVal;
      document.getElementById('editSub_status').value = u.status === 'expiring' ? 'active' : u.status;
      document.getElementById('editSub_reason').value = '';
      modalEditSub.classList.remove('hidden');
    });
  }

  document.getElementById('btnStepperMinus').addEventListener('click', () => {
    if (editStepperVal > 1) {
      editStepperVal--;
      document.getElementById('stepperVal').textContent = editStepperVal;
    }
  });
  document.getElementById('btnStepperPlus').addEventListener('click', () => {
    editStepperVal++;
    document.getElementById('stepperVal').textContent = editStepperVal;
  });

  document.getElementById('btnEditSubCancel').addEventListener('click', () => {
    modalEditSub.classList.add('hidden');
  });

  document.getElementById('btnEditSubSave').addEventListener('click', async () => {
    const u = currentUsers.find(x => x.id === selectedUserId);
    if (!u) return;

    // Validate devices limit against active devices count
    if (editStepperVal < u.devices.length) {
      showToast(`Нельзя установить лимит ${editStepperVal}: у пользователя подключено ${u.devices.length} устройства.`);
      return;
    }

    const btn = document.getElementById('btnEditSubSave');
    btn.textContent = 'Сохранение...';
    btn.disabled = true;

    const newPlan = document.getElementById('editSub_plan').value;
    const newDate = document.getElementById('editSub_date').value;
    const newStatus = document.getElementById('editSub_status').value;
    const reason = document.getElementById('editSub_reason').value.trim();

    await userApi.request(users => {
      const usr = users.find(x => x.id === selectedUserId);
      if (usr) {
        let changes = [];
        if (usr.plan !== newPlan) { changes.push(`Тариф: ${usr.plan} → ${newPlan}`); usr.plan = newPlan; }
        if (usr.expiryDate !== newDate) { changes.push(`Дата окончания: ${formatDateRu(usr.expiryDate)} → ${formatDateRu(newDate)}`); usr.expiryDate = newDate; }
        if (usr.devicesLimit !== editStepperVal) { changes.push(`Лимит устройств: ${usr.devicesLimit} → ${editStepperVal}`); usr.devicesLimit = editStepperVal; }
        if (usr.status !== newStatus) { 
          changes.push(`Статус: ${usr.status} → ${newStatus}`); 
          usr.status = newStatus;
          if (newStatus === 'disabled' || newStatus === 'paused') {
            usr.devices.forEach(d => { d.status = 'disabled'; d.disableReason = 'subscription_disabled'; });
          }
        }
        if (changes.length > 0) {
          usr.history.unshift({ date: 'Сегодня', text: `Изменения подписки: ${changes.join(', ')}${reason ? ' ('+reason+')' : ''}`, admin: 'Артемий' });
        }
      }
    });

    currentUsers = await userApi.getUsers();
    btn.textContent = 'Сохранить';
    btn.disabled = false;
    modalEditSub.classList.add('hidden');
    showToast('Подписка изменена');
    openUserDetail(selectedUserId);
    renderUsersList();
  });

  // Device Menu (•••) Sheet Actions
  const menuDeviceActions = document.getElementById('menuDeviceActions');
  document.getElementById('btnDevAct_close').addEventListener('click', () => {
    menuDeviceActions.classList.add('hidden');
  });

  document.getElementById('btnDevAct_rebuild').addEventListener('click', async () => {
    menuDeviceActions.classList.add('hidden');
    await userApi.request(users => {
      const u = users.find(x => x.id === selectedUserId);
      if (u) {
        const d = u.devices.find(x => x.id === selectedDeviceId);
        if (d) u.history.unshift({ date: 'Сегодня', text: `Настройки ключа ${d.name} обновлены`, admin: 'Артемий' });
      }
    });
    currentUsers = await userApi.getUsers();
    showToast('Настройки ключа обновлены');
    openUserDetail(selectedUserId);
  });

  document.getElementById('btnDevAct_replace').addEventListener('click', async () => {
    menuDeviceActions.classList.add('hidden');
    let newKey = '';
    let devName = '';
    await userApi.request(users => {
      const u = users.find(x => x.id === selectedUserId);
      if (u) {
        const d = u.devices.find(x => x.id === selectedDeviceId);
        if (d) {
          devName = d.name;
          d.mockRef = `mock-device-record-rotated-${selectedDeviceId}-${Math.floor(Math.random() * 8999 + 1000)}`;
          d.status = 'active';
          newKey = d.mockRef;
          u.history.unshift({ date: 'Сегодня', text: `Ключ ${d.name} заменён`, admin: 'Артемий' });
        }
      }
    });
    currentUsers = await userApi.getUsers();
    document.getElementById('newKeyDeviceLabel').textContent = devName;
    document.getElementById('newKeyMaskedBox').textContent = maskMockDeviceReference(newKey);
    document.getElementById('newKeyTextarea').value = newKey;
    document.getElementById('newKeyMaskedBox').classList.remove('hidden');
    document.getElementById('newKeyTextarea').classList.add('hidden');
    document.getElementById('btnToggleUnmaskNewKey').textContent = 'Показать полностью';
    document.getElementById('modalNewKeyCreated').classList.remove('hidden');
    openUserDetail(selectedUserId);
  });

  document.getElementById('btnToggleUnmaskNewKey').addEventListener('click', () => {
    const maskedBox = document.getElementById('newKeyMaskedBox');
    const textarea = document.getElementById('newKeyTextarea');
    const btn = document.getElementById('btnToggleUnmaskNewKey');
    if (textarea.classList.contains('hidden')) {
      textarea.classList.remove('hidden');
      maskedBox.classList.add('hidden');
      btn.textContent = 'Скрыть';
    } else {
      textarea.classList.add('hidden');
      maskedBox.classList.remove('hidden');
      btn.textContent = 'Показать полностью';
    }
  });

  document.getElementById('btnNewKeyCopy').addEventListener('click', async () => {
    await copyWithFeedback(document.getElementById('newKeyTextarea').value, 'Новый ключ скопирован');
  });

  document.getElementById('btnNewKeyDone').addEventListener('click', () => {
    document.getElementById('modalNewKeyCreated').classList.add('hidden');
  });

  document.getElementById('btnDevAct_disable').addEventListener('click', async () => {
    menuDeviceActions.classList.add('hidden');
    await userApi.request(users => {
      const u = users.find(x => x.id === selectedUserId);
      if (u) {
        const d = u.devices.find(x => x.id === selectedDeviceId);
        if (d) {
          d.status = d.status === 'active' ? 'disabled' : 'active';
          d.disableReason = d.status === 'disabled' ? 'manual_disabled' : null;
          u.history.unshift({ date: 'Сегодня', text: `Ключ ${d.name} ${d.status === 'active' ? 'включён' : 'отключён'}`, admin: 'Артемий' });
        }
      }
    });
    currentUsers = await userApi.getUsers();
    showToast('Статус ключа изменён');
    openUserDetail(selectedUserId);
  });

  document.getElementById('btnDevAct_rename').addEventListener('click', () => {
    menuDeviceActions.classList.add('hidden');
    const u = currentUsers.find(x => x.id === selectedUserId);
    if (!u) return;
    const d = u.devices.find(x => x.id === selectedDeviceId);
    if (d) {
      document.getElementById('renameDeviceInput').value = d.name;
      document.getElementById('modalRenameDevice').classList.remove('hidden');
    }
  });

  document.getElementById('btnRenameDevCancel').addEventListener('click', () => {
    document.getElementById('modalRenameDevice').classList.add('hidden');
  });

  document.getElementById('btnRenameDevSave').addEventListener('click', async () => {
    const newName = document.getElementById('renameDeviceInput').value.trim();
    if (!newName) { showToast('Имя не может быть пустым'); return; }
    
    await userApi.request(users => {
      const u = users.find(x => x.id === selectedUserId);
      if (u) {
        const d = u.devices.find(x => x.id === selectedDeviceId);
        if (d) {
          const oldName = d.name;
          d.name = newName;
          u.history.unshift({ date: 'Сегодня', text: `Устройство переименовано: ${oldName} → ${newName}`, admin: 'Артемий' });
        }
      }
    });
    currentUsers = await userApi.getUsers();
    document.getElementById('modalRenameDevice').classList.add('hidden');
    showToast('Устройство переименовано');
    openUserDetail(selectedUserId);
  });

  document.getElementById('btnDevAct_delete').addEventListener('click', async () => {
    const user = currentUsers.find((item) => item.id === selectedUserId);
    const device = user?.devices.find((item) => item.id === selectedDeviceId);
    if (!device || !window.confirm(`Удалить устройство «${device.name}»? Ключ на нём перестанет работать.`)) return;
    menuDeviceActions.classList.add('hidden');
    await userApi.request(users => {
      const u = users.find(x => x.id === selectedUserId);
      if (u) {
        const d = u.devices.find(x => x.id === selectedDeviceId);
        if (d) {
          u.devices = u.devices.filter(x => x.id !== selectedDeviceId);
          u.history.unshift({ date: 'Сегодня', text: `Устройство ${d.name} удалено`, admin: 'Артемий' });
        }
      }
    });
    currentUsers = await userApi.getUsers();
    showToast('Устройство удалено');
    openUserDetail(selectedUserId);
  });

  // Add Device Modal
  const btnUdAddDevice = document.getElementById('btnUdAddDevice');
  if (btnUdAddDevice) {
    btnUdAddDevice.addEventListener('click', () => {
      const u = currentUsers.find(x => x.id === selectedUserId);
      if (!u) return;
      if (u.devices.length >= u.devicesLimit) {
        showToast(`Использовано ${u.devices.length} из ${u.devicesLimit} доступных устройств.`);
        return;
      }
      // Add Device Logic
      addDeviceForSelectedUser();
    });
  }

  // Admin Note Save Modal
  const btnUdEditNote = document.getElementById('btnUdEditNote');
  const modalUserNote = document.getElementById('modalUserNote');
  if (btnUdEditNote && modalUserNote) {
    btnUdEditNote.addEventListener('click', () => {
      const u = currentUsers.find(x => x.id === selectedUserId);
      if (!u) return;
      document.getElementById('noteInputText').value = u.note || '';
      modalUserNote.classList.remove('hidden');
    });
  }

  document.getElementById('btnModalNote_cancel').addEventListener('click', () => {
    modalUserNote.classList.add('hidden');
  });

  document.getElementById('btnModalNote_save').addEventListener('click', async () => {
    const btn = document.getElementById('btnModalNote_save');
    btn.textContent = 'Сохранение...';
    btn.disabled = true;

    const newNote = document.getElementById('noteInputText').value.trim();

    await userApi.request(users => {
      const u = users.find(x => x.id === selectedUserId);
      if (u) {
        u.note = newNote;
        u.history.unshift({ date: 'Сегодня', text: 'Заметка администратора изменена', admin: 'Артемий' });
      }
    });

    currentUsers = await userApi.getUsers();
    btn.textContent = 'Сохранить';
    btn.disabled = false;
    modalUserNote.classList.add('hidden');
    showToast('Заметка сохранена');
    openUserDetail(selectedUserId);
  });

  // Block Modal
  const btnUdBlockUser = document.getElementById('btnUdBlockUser');
  const modalBlockUser = document.getElementById('modalBlockUser');
  if (btnUdBlockUser && modalBlockUser) {
    btnUdBlockUser.addEventListener('click', () => {
      modalBlockUser.classList.remove('hidden');
    });
  }

  document.getElementById('btnModalBlock_cancel').addEventListener('click', () => {
    modalBlockUser.classList.add('hidden');
  });

  document.getElementById('btnModalBlock_confirm').addEventListener('click', async () => {
    const reason = document.getElementById('blockReasonInput').value.trim();
    if (!reason) { showToast('Укажите причину блокировки'); return; }

    const btn = document.getElementById('btnModalBlock_confirm');
    btn.textContent = 'Сохранение...';
    btn.disabled = true;

    await userApi.request(users => {
      const u = users.find(x => x.id === selectedUserId);
      if (u) {
        u.status = 'blocked';
        u.subStatusText = 'Заблокирован';
        u.blockReason = reason;
        u.devices.forEach(d => { d.status = 'disabled'; d.disableReason = 'user_blocked'; });
        u.history.unshift({ date: 'Сегодня', text: `Заблокирован: ${reason}`, admin: 'Артемий' });
      }
    });

    currentUsers = await userApi.getUsers();
    btn.textContent = 'Заблокировать';
    btn.disabled = false;
    modalBlockUser.classList.add('hidden');
    showToast('Пользователь заблокирован');
    openUserDetail(selectedUserId);
    renderUsersList();
  });

  // Soft Delete Modal
  const btnUdDeleteUser = document.getElementById('btnUdDeleteUser');
  const modalDeleteUser = document.getElementById('modalDeleteUser');
  const deleteConfirmInput = document.getElementById('deleteConfirmInput');
  const btnModalDelete_confirm = document.getElementById('btnModalDelete_confirm');

  if (btnUdDeleteUser && modalDeleteUser) {
    btnUdDeleteUser.addEventListener('click', () => {
      deleteConfirmInput.value = '';
      btnModalDelete_confirm.disabled = true;
      btnModalDelete_confirm.style.opacity = '0.5';
      modalDeleteUser.classList.remove('hidden');
    });
  }

  if (deleteConfirmInput) {
    deleteConfirmInput.addEventListener('input', () => {
      if (deleteConfirmInput.value.trim().toUpperCase() === 'УДАЛИТЬ') {
        btnModalDelete_confirm.disabled = false;
        btnModalDelete_confirm.style.opacity = '1';
      } else {
        btnModalDelete_confirm.disabled = true;
        btnModalDelete_confirm.style.opacity = '0.5';
      }
    });
  }

  document.getElementById('btnModalDelete_cancel').addEventListener('click', () => {
    modalDeleteUser.classList.add('hidden');
  });

  btnModalDelete_confirm.addEventListener('click', async () => {
    btnModalDelete_confirm.textContent = 'Сохранение...';
    btnModalDelete_confirm.disabled = true;

    await userApi.request(users => {
      const u = users.find(x => x.id === selectedUserId);
      if (u) {
        u.status = 'deleted';
        u.subStatusText = 'Удалён';
        u.devices.forEach(d => { d.status = 'disabled'; });
        u.history.unshift({ date: 'Сегодня', text: 'Пользователь переведён в статус Удалён', admin: 'Артемий' });
      }
    });

    currentUsers = await userApi.getUsers();
    btnModalDelete_confirm.textContent = 'Удалить';
    btnModalDelete_confirm.disabled = false;
    modalDeleteUser.classList.add('hidden');
    showToast('Пользователь переведён в статус Удалён');
    closeOverlay(document.getElementById('page-user-detail'));
    renderUsersList();
  });

  // Disable Sub Action Button
  const btnUdDisableSub = document.getElementById('btnUdDisableSub');
  if (btnUdDisableSub) {
    btnUdDisableSub.addEventListener('click', async () => {
      const u = currentUsers.find(x => x.id === selectedUserId);
      if (!u) return;

      if (u.status === 'nosub' || u.status === 'disabled') {
        // Resume Sub logic
        await userApi.request(users => {
          const usr = users.find(x => x.id === selectedUserId);
          if (usr) {
            usr.status = 'active';
            usr.subStatusText = 'Подписка активна';
            usr.devices.forEach(d => {
              if (d.disableReason === 'subscription_disabled') { d.status = 'active'; d.disableReason = null; }
            });
            usr.history.unshift({ date: 'Сегодня', text: 'Подписка возобновлена', admin: 'Артемий' });
          }
        });
        currentUsers = await userApi.getUsers();
        showToast('Подписка возобновлена');
      } else {
        // Disable Sub logic
        await userApi.request(users => {
          const usr = users.find(x => x.id === selectedUserId);
          if (usr) {
            usr.status = 'nosub';
            usr.subStatusText = 'Отключена администратором';
            usr.devices.forEach(d => {
              if (d.status === 'active') { d.status = 'disabled'; d.disableReason = 'subscription_disabled'; }
            });
            usr.history.unshift({ date: 'Сегодня', text: 'Подписка отключена администратором', admin: 'Артемий' });
          }
        });
        currentUsers = await userApi.getUsers();
        showToast('Подписка отключена');
      }
      openUserDetail(selectedUserId);
      renderUsersList();
    });
  }

  // Show Key Unmask Toggle
  document.getElementById('btnToggleUnmaskKey').addEventListener('click', () => {
    const maskedBox = document.getElementById('showKeyMaskedBox');
    const textarea = document.getElementById('showKeyTextarea');
    const btn = document.getElementById('btnToggleUnmaskKey');
    if (textarea.classList.contains('hidden')) {
      textarea.classList.remove('hidden');
      maskedBox.classList.add('hidden');
      btn.textContent = 'Скрыть';
    } else {
      textarea.classList.add('hidden');
      maskedBox.classList.remove('hidden');
      btn.textContent = 'Показать полностью';
    }
  });

  document.getElementById('btnModalShowKey_close').addEventListener('click', () => {
    document.getElementById('modalShowKey').classList.add('hidden');
  });
  document.getElementById('btnModalShowKey_copy').addEventListener('click', async () => {
    document.getElementById('modalShowKey').classList.add('hidden');
    await copyWithFeedback(document.getElementById('showKeyTextarea').value, 'Ключ скопирован');
  });

  // Full History Modal Close
  document.getElementById('btnFullHistoryClose').addEventListener('click', () => {
    document.getElementById('modalFullUserHistory').classList.add('hidden');
  });
});

function maskMockDeviceReference(reference) {
  if (!reference || reference.length < 20) return 'mock-device-record-••••••••';
  const prefix = reference.substring(0, 12);
  const suffix = reference.substring(reference.length - 8);
  return `${prefix}••••••••••••${suffix}`;
}

function handleOpenTelegramChat() {
  const u = currentUsers.find(x => x.id === selectedUserId);
  if (!u) return;

  // Local mock must never open a real Telegram profile or message thread.
  // API integration will provide a protected admin-to-user messaging action.
  showToast(`Mock-режим: сообщение для ${u.name} не отправлялось.`);
}

async function addDeviceForSelectedUser() {
  await userApi.request(users => {
    const u = users.find(x => x.id === selectedUserId);
    if (u) {
      const devId = 'd-' + Math.floor(Math.random()*900 + 100);
      const newDev = {
        id: devId,
        name: `Новое устройство (${u.devices.length + 1})`,
        app: "Karing",
        status: "active",
        disableReason: null,
        lastSeen: "Только что",
        mockRef: `mock-device-record-${devId}`
      };
      u.devices.push(newDev);
      u.history.unshift({ date: 'Сегодня', text: `Добавлено новое устройство: ${newDev.name}`, admin: 'Артемий' });
    }
  });
  currentUsers = await userApi.getUsers();
  showToast('Устройство добавлено!');
  openUserDetail(selectedUserId);
}

function formatDateRu(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function updateExtendPreview(u, addMonths) {
  let baseDate = new Date();
  const expDate = new Date(u.expiryDate);
  if (expDate > baseDate) baseDate = expDate;
  baseDate.setMonth(baseDate.getMonth() + addMonths);
  document.getElementById('extendNewDatePreview').textContent = `Новая дата окончания: ${formatDateRu(baseDate.toISOString().split('T')[0])}`;
}

function renderUsersList() {
  const container = document.getElementById('usersListContainer');
  if (!container) return;

  const searchQuery = (document.getElementById('usersSearchInput')?.value || '').toLowerCase().trim();
  const sortValue = document.getElementById('usersSortSelect')?.value || 'newest';

  let filtered = currentUsers.filter(u => {
    // Filter by Tab
    if (currentFilter === 'active' && u.status !== 'active') return false;
    if (currentFilter === 'expiring' && u.status !== 'expiring') return false;
    if (currentFilter === 'nosub' && u.status !== 'nosub') return false;
    if (currentFilter === 'blocked' && u.status !== 'blocked') return false;
    if (currentFilter === 'deleted' && u.status !== 'deleted') return false;
    if (currentFilter !== 'deleted' && u.status === 'deleted') return false;

    // Search query
    if (searchQuery) {
      const matchName = u.name.toLowerCase().includes(searchQuery);
      const matchUsername = u.username.toLowerCase().includes(searchQuery);
      const matchTgId = u.tgId.includes(searchQuery);
      const matchUserId = u.userId.includes(searchQuery);
      const matchKey = u.devices.some(d => d.mockRef.toLowerCase().includes(searchQuery));
      return matchName || matchUsername || matchTgId || matchUserId || matchKey;
    }
    return true;
  });

  // Sorting
  if (sortValue === 'name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortValue === 'expiry') {
    filtered.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  }

  document.getElementById('usersCountLabel').textContent = `Найдено: ${filtered.length} пользователей`;

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;color:rgba(255,255,255,0.4);padding:24px 0;font-size:13px;';
    empty.textContent = 'Пользователи не найдены';
    container.replaceChildren(empty);
    return;
  }

  // User names and usernames will come from the API. Build cards with DOM APIs
  // so a value from a profile cannot turn into executable markup.
  const rows = document.createDocumentFragment();
  filtered.forEach((user) => {
    const state = getUserStatusPresentation(user.status);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'user-item-row';
    row.style.cssText = 'width:100%;border:0;background:transparent;text-align:left;cursor:pointer;';
    row.addEventListener('click', () => handleUserRowClick(user.id));

    const dot = document.createElement('div');
    dot.className = `user-status-dot ${state.dotClass}`;

    const info = document.createElement('div');
    info.className = 'user-item-info';
    const name = document.createElement('div');
    name.className = 'user-item-name';
    name.textContent = user.name || 'Без имени';
    const identity = document.createElement('div');
    identity.className = 'user-item-subtext';
    identity.textContent = `${user.username || 'без username'} · ID ${user.userId || '—'}`;
    const subscription = document.createElement('div');
    subscription.className = 'user-item-subtext';
    subscription.style.cssText = 'color:rgba(255,255,255,0.7);margin-top:2px;';
    if (user.pendingPay) {
      subscription.style.color = '#FF9500';
      subscription.textContent = 'Ожидает подтверждения оплаты';
    } else {
      subscription.textContent = `${user.plan || 'Без тарифа'} · до ${user.expiryDate ? `${user.expiryDate.split('-')[2]} ${getMonthShortName(user.expiryDate)}` : '—'}`;
    }
    info.append(name, identity, subscription);

    const meta = document.createElement('div');
    meta.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const deviceCount = document.createElement('span');
    deviceCount.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.4);';
    deviceCount.textContent = `${user.devices.length} устройств`;
    const arrow = document.createElement('span');
    arrow.style.cssText = 'color:rgba(255,255,255,0.3);font-size:14px;';
    arrow.textContent = '→';
    meta.append(deviceCount, arrow);

    row.append(dot, info, meta);
    rows.append(row);
  });
  container.replaceChildren(rows);
}

function getUserStatusPresentation(status) {
  const states = {
    active: { label: 'Активен', badgeClass: '', dotClass: 'active' },
    expiring: { label: 'Истекает скоро', badgeClass: 'expiring', dotClass: 'expiring' },
    nosub: { label: 'Без подписки', badgeClass: 'nosub', dotClass: 'nosub' },
    blocked: { label: 'Заблокирован', badgeClass: 'blocked', dotClass: 'blocked' },
    deleted: { label: 'Удалён', badgeClass: 'deleted', dotClass: 'blocked' },
    disabled: { label: 'Подписка отключена', badgeClass: 'blocked', dotClass: 'blocked' },
    paused: { label: 'Приостановлен', badgeClass: 'blocked', dotClass: 'blocked' }
  };
  return states[status] || { label: 'Статус не указан', badgeClass: 'blocked', dotClass: 'blocked' };
}

function handleUserRowClick(userId) {
  // Save exact scroll position BEFORE opening profile
  const tabContainer = document.querySelector('#admin-tab-users').parentElement;
  if (tabContainer) savedListState.scrollTop = tabContainer.scrollTop;
  openUserDetail(userId);
}

function getMonthShortName(dateStr) {
  const d = new Date(dateStr);
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return months[d.getMonth()];
}

function openUserDetail(userId) {
  const u = currentUsers.find(x => x.id === userId);
  if (!u) return;
  selectedUserId = userId;

  const page = document.getElementById('page-user-detail');
  if (!page) return;

  // Header & Identity
  document.getElementById('udHeaderTitle').textContent = u.name;
  document.getElementById('udName').textContent = u.name;
  document.getElementById('udUsername').textContent = u.username || 'Без username';
  document.getElementById('udTgId').textContent = u.tgId;
  document.getElementById('udUserId').textContent = u.userId;

  const badge = document.getElementById('udStatusBadge');
  if (badge) {
    const status = getUserStatusPresentation(u.status);
    badge.textContent = status.label;
    badge.className = `user-status-badge ${status.badgeClass}`.trim();
  }

  // Subscription
  document.getElementById('udSubPlan').textContent = u.plan;
  document.getElementById('udSubDate').textContent = `До ${formatDateRu(u.expiryDate)}`;
  document.getElementById('udSubLeft').textContent = u.status === 'active' ? 'Подписка активна' : u.subStatusText;

  // Disable / Resume button text
  const btnDisable = document.getElementById('btnUdDisableSub');
  if (btnDisable) {
    if (u.status === 'nosub' || u.status === 'disabled') {
      btnDisable.textContent = 'Возобновить подписку';
      btnDisable.style.color = 'var(--lime)';
      btnDisable.style.borderColor = 'rgba(184, 255, 0, 0.4)';
    } else {
      btnDisable.textContent = 'Отключить подписку';
      btnDisable.style.color = '#FF3B30';
      btnDisable.style.borderColor = 'rgba(255, 59, 48, 0.3)';
    }
  }

  // Devices List with `•••` action menu
  document.getElementById('udDevicesCount').textContent = `${u.devices.length} из ${u.devicesLimit}`;
  const devListContainer = document.getElementById('udDevicesList');
  if (devListContainer) {
    if (u.devices.length === 0) {
      devListContainer.innerHTML = `<div style="font-size:13px; color:rgba(255,255,255,0.4); padding:10px 0;">Устройства отсутствуют</div>`;
    } else {
      let devHtml = '';
      u.devices.forEach(d => {
        const isDevActive = d.status === 'active';
        devHtml += `
          <div style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:14px; font-weight:600; color:#fff;">${escapeHtml(d.name)}</span>
              <span style="font-size:11px; color:${isDevActive ? 'rgba(255,255,255,0.4)' : '#FF3B30'};">${escapeHtml(d.app)} · ${isDevActive ? 'ключ активен' : 'ключ отключён'}</span>
            </div>
            <div style="display:flex; gap:8px; margin-top:8px;">
              <button class="admin-btn-secondary" data-device-copy="${d.id}" style="font-size:12px; padding:6px 12px; flex:1;">Скопировать ключ</button>
              <button class="admin-btn-secondary" data-device-show="${d.id}" style="font-size:12px; padding:6px 12px;">Показать</button>
              <button class="admin-btn-secondary" data-device-menu="${d.id}" style="font-size:12px; padding:6px 10px;">•••</button>
            </div>
          </div>
        `;
      });
      devListContainer.innerHTML = devHtml;
      devListContainer.querySelectorAll('[data-device-copy]').forEach((button) => {
        button.addEventListener('click', () => copyDeviceKey(button.dataset.deviceCopy));
      });
      devListContainer.querySelectorAll('[data-device-show]').forEach((button) => {
        button.addEventListener('click', () => showDeviceKeyModal(button.dataset.deviceShow));
      });
      devListContainer.querySelectorAll('[data-device-menu]').forEach((button) => {
        button.addEventListener('click', () => openDeviceMenu(button.dataset.deviceMenu));
      });
    }
  }

  // Payments
  document.getElementById('udLastPay').textContent = u.lastPay;
  document.getElementById('udTotalPay').textContent = u.totalPay;

  // Section 4: Conditional - Referrals
  const refBlock = document.getElementById('udReferralsBlock');
  if (u.referral && u.referral.count > 0) {
    refBlock.style.display = 'block';
    document.getElementById('udRefUsersCount').textContent = u.referral.count;
    document.getElementById('udRefBonus').textContent = `${u.referral.bonusDays} дней`;
  } else {
    refBlock.style.display = 'none';
  }

  // Section 5: Registration Source (Hidden if unknown/untracked)
  const regSourceBlock = document.getElementById('udRegSourceBlock');
  if (u.regSource && (u.regSource.title || u.regSource.name)) {
    const sourceTitle = u.regSource.title || (u.regSource.type === 'partner' ? `Партнёрская ссылка · ${u.regSource.name}` : u.regSource.name);
    regSourceBlock.style.display = 'block';
    document.getElementById('udRegSourceVal').textContent = sourceTitle;

    // Reg Date
    const regDateRow = document.getElementById('udRegDateRow');
    if (u.regSource.regDate) {
      regDateRow.style.display = 'flex';
      document.getElementById('udRegDateVal').textContent = u.regSource.regDate;
    } else {
      regDateRow.style.display = 'none';
    }

    // First Pay Date
    const firstPayRow = document.getElementById('udFirstPayRow');
    if (u.regSource.firstPayDate) {
      firstPayRow.style.display = 'flex';
      document.getElementById('udFirstPayVal').textContent = u.regSource.firstPayDate;
    } else {
      firstPayRow.style.display = 'none';
    }

    // Ref Bonus Status
    const refBonusRow = document.getElementById('udRefBonusRow');
    if (u.regSource.bonusStatus) {
      refBonusRow.style.display = 'flex';
      document.getElementById('udRefBonusVal').textContent = u.regSource.bonusStatus;
    } else {
      refBonusRow.style.display = 'none';
    }

    // Inviter / Partner Button
    const partnerLinkRow = document.getElementById('udPartnerLinkRow');
    if (u.regSource.inviterUserId) {
      partnerLinkRow.style.display = 'block';
    } else {
      partnerLinkRow.style.display = 'none';
    }
  } else {
    // Hide block completely if source is unknown or not tracked!
    regSourceBlock.style.display = 'none';
  }

  // Section 6: Conditional - Partner Program (If user IS a partner)
  const partnerProgramBlock = document.getElementById('udPartnerProgramBlock');
  if (u.partnerProgram && u.partnerProgram.isPartner) {
    partnerProgramBlock.style.display = 'block';
    document.getElementById('udPartnerStatus').textContent = u.partnerProgram.statusText || 'Активный партнёр';
    document.getElementById('udPartnerInvited').textContent = u.partnerProgram.invitedCount || '0';
    document.getElementById('udPartnerPaid').textContent = u.partnerProgram.paidCount || '0';
    document.getElementById('udPartnerNextBonus').textContent = u.partnerProgram.nextBonusProgress || '0 / 5 оплат';
    document.getElementById('udPartnerTotalBonus').textContent = u.partnerProgram.totalBonusMonths || '0 месяцев';
  } else {
    partnerProgramBlock.style.display = 'none';
  }

  // Note
  document.getElementById('udNoteText').textContent = u.note || 'Заметка отсутствует';

  // History List (Show last 4 entries + button if more)
  const histContainer = document.getElementById('udHistoryList');
  if (histContainer) {
    const recent = u.history.slice(0, 4);
    let hHtml = '';
    recent.forEach(h => {
      hHtml += `
        <div style="padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
          <div style="font-size:11px; color:rgba(255,255,255,0.4);">${escapeHtml(h.date)}${h.admin ? ` · ${escapeHtml(h.admin)}` : ''}</div>
          <div style="font-size:13px; color:rgba(255,255,255,0.8); margin-top:2px;">${escapeHtml(h.text)}</div>
        </div>
      `;
    });
    if (u.history.length > 4) {
      hHtml += `
        <button class="admin-btn-secondary" onclick="openFullHistoryModal()" style="margin-top:8px; width:100%; font-size:12px; padding:8px;">
          Показать всю историю (${u.history.length})
        </button>
      `;
    }
    histContainer.innerHTML = hHtml;
  }

  openOverlay(page);
}

function openDeviceMenu(devId) {
  selectedDeviceId = devId;
  const u = currentUsers.find(x => x.id === selectedUserId);
  if (!u) return;
  const dev = u.devices.find(d => d.id === devId);
  if (!dev) return;

  document.getElementById('deviceMenuTitle').textContent = `Действия с устройством (${dev.name})`;
  const btnDisable = document.getElementById('btnDevAct_disable');
  if (btnDisable) {
    btnDisable.textContent = dev.status === 'active' ? 'Отключить ключ' : 'Создать ключ';
  }
  document.getElementById('menuDeviceActions').classList.remove('hidden');
}

function openFullHistoryModal() {
  const u = currentUsers.find(x => x.id === selectedUserId);
  if (!u) return;

  const container = document.getElementById('fullHistoryContainer');
  if (container) {
    let html = '';
    u.history.forEach(h => {
      html += `
        <div style="padding: 8px 10px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="font-size:11px; color:rgba(255,255,255,0.4);">${escapeHtml(h.date)}${h.admin ? ` · ${escapeHtml(h.admin)}` : ''}</div>
          <div style="font-size:13px; color:rgba(255,255,255,0.9); margin-top:3px;">${escapeHtml(h.text)}</div>
        </div>
      `;
    });
    container.innerHTML = html;
  }
  document.getElementById('modalFullUserHistory').classList.remove('hidden');
}

async function copyDeviceKey(devId) {
  const u = currentUsers.find(x => x.id === selectedUserId);
  if (!u) return;
  const dev = u.devices.find(d => d.id === devId);
  if (!dev) return;
  if (!dev.mockRef || dev.status === 'disabled') {
    showToast('У устройства нет активного ключа');
    return;
  }
  await copyWithFeedback(dev.mockRef, `Mock-идентификатор ${dev.name} скопирован`);
}

function showDeviceKeyModal(devId) {
  const u = currentUsers.find(x => x.id === selectedUserId);
  if (!u) return;
  const dev = u.devices.find(d => d.id === devId);
  if (!dev) return;

  document.getElementById('showKeyDeviceName').textContent = `${dev.name} (${dev.app})`;
  document.getElementById('showKeyMaskedBox').textContent = maskMockDeviceReference(dev.mockRef);
  document.getElementById('showKeyTextarea').value = dev.mockRef;
  document.getElementById('showKeyMaskedBox').classList.remove('hidden');
  document.getElementById('showKeyTextarea').classList.add('hidden');
  document.getElementById('btnToggleUnmaskKey').textContent = 'Показать полностью';
  document.getElementById('modalShowKey').classList.remove('hidden');
}
