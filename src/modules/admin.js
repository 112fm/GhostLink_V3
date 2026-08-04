(() => {
const GhostLinkV3 = window.GhostLinkV3 = window.GhostLinkV3 || {};

GhostLinkV3.initAdminModule = function initAdminModule(dependencies = {}) {
  const { showToast, copyText, openOverlay, closeOverlay, returnToHome } = dependencies;

  async function copyWithFeedback(value, successMessage) {
    const copied = await copyText(value);
    showToast(copied ? successMessage : 'Не удалось скопировать. Нажмите и удерживайте текст.');
    return copied;
  }

// --- Support Tab Logic ---

// Support FAQ Accordion
document.querySelectorAll('.faq-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Check if it's already expanded
    const isExpanded = item.classList.contains('expanded');
    
    // Close other expanded FAQs
    document.querySelectorAll('.faq-item.expanded').forEach(otherItem => {
      if (otherItem !== item) {
        otherItem.classList.remove('expanded');
        const details = otherItem.querySelector('.faq-content');
        if (details) details.style.maxHeight = null;
      }
    });

    if (isExpanded) {
      item.classList.remove('expanded');
      const details = item.querySelector('.faq-content');
      if (details) details.style.maxHeight = null;
    } else {
      item.classList.add('expanded');
      const details = item.querySelector('.faq-content');
      const inner = item.querySelector('.faq-content-inner');
      if (details && inner) {
        details.style.maxHeight = inner.offsetHeight + 24 + 'px'; // + padding
      }
    }
  });
});

// Support Chat Button (Internal UI)
const supportChatInput = document.getElementById('supportChatInput');
const btnSupportChatSend = document.getElementById('btnSupportChatSend');
const supportChatHistory = document.getElementById('supportChatHistory');

if (btnSupportChatSend && supportChatInput && supportChatHistory && !document.getElementById('tab-support')?.dataset.supportRuntime) {
  const typingIndicator = document.getElementById('supportTypingIndicator');
  const btnSupportChatAttach = document.getElementById('btnSupportChatAttach');
  const chatFileInput = document.getElementById('chatFileInput');
  const MAX_SUPPORT_ATTACHMENTS_PER_PICK = 3;
  const MAX_SUPPORT_FILE_BYTES = 20 * 1024 * 1024;
  const MAX_SUPPORT_VIDEO_SECONDS = 30;

  // Anti-Spam State
  let messageTimestamps = [];
  let isCooldownActive = false;
  let cooldownTimer = null;

  // File Upload & Attachment Logic
  const processFile = (file) => {
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      showToast('Поддерживаются только фото и видео');
      return;
    }

    if (file.size > MAX_SUPPORT_FILE_BYTES) {
      showToast('Файл больше 20 МБ. Выберите файл поменьше.');
      return;
    }

    const fileUrl = URL.createObjectURL(file);

    if (isVideo) {
      // Validate Video Duration <= 30 seconds
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.src = fileUrl;

      tempVideo.onloadedmetadata = () => {
        if (tempVideo.duration > MAX_SUPPORT_VIDEO_SECONDS) {
          showToast('Видео длиннее 30 секунд. Выберите фрагмент короче.');
          URL.revokeObjectURL(fileUrl);
          return;
        }
        appendMediaMessage(fileUrl, 'video');
      };

      tempVideo.onerror = () => {
        showToast('Не удалось прочитать видео. Выберите другой файл.');
        URL.revokeObjectURL(fileUrl);
      };
    } else {
      appendMediaMessage(fileUrl, 'image');
    }
  };

  const appendMediaMessage = (url, type) => {
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    const mediaTag = type === 'video'
      ? `<video src="${url}" controls preload="metadata"></video>`
      : `<img src="${url}" alt="Фото" />`;

    const msgHtml = `
      <div class="chat-message out media-message">
        ${mediaTag}
        <div class="message-meta">
          <span class="message-time">${timeString}</span>
          <span class="message-local-status">Файл подготовлен</span>
        </div>
      </div>
    `;

    const liveTyping = document.getElementById('supportTypingIndicator');
    const liveHistory = document.getElementById('supportChatHistory');

    if (liveTyping && liveTyping.parentNode === liveHistory) {
      liveTyping.insertAdjacentHTML('beforebegin', msgHtml);
    } else if (liveHistory) {
      liveHistory.insertAdjacentHTML('beforeend', msgHtml);
    }

    if (liveHistory) {
      liveHistory.scrollTo({
        top: liveHistory.scrollHeight,
        behavior: 'smooth'
      });
    }

    showToast('Файл подготовлен. Отправка появится после подключения чата.');
  };

  // Attachment Button click
  if (btnSupportChatAttach && chatFileInput) {
    btnSupportChatAttach.addEventListener('click', () => {
      chatFileInput.click();
    });

    chatFileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > MAX_SUPPORT_ATTACHMENTS_PER_PICK) {
        showToast('За раз можно выбрать до 3 файлов.');
      }
      files.slice(0, MAX_SUPPORT_ATTACHMENTS_PER_PICK).forEach(file => processFile(file));
      chatFileInput.value = '';
    });
  }

  // Paste Image/Video from Clipboard handler
  supportChatInput.addEventListener('paste', (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const files = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter(Boolean);

    if (files.length) {
      e.preventDefault();
      if (files.length > MAX_SUPPORT_ATTACHMENTS_PER_PICK) {
        showToast('За раз можно вставить до 3 файлов.');
      }
      files.slice(0, MAX_SUPPORT_ATTACHMENTS_PER_PICK).forEach(file => processFile(file));
    }
  });

  // Reply & Context Menu State
  let activeTargetMsg = null;
  let activeReplyData = null;
  let touchTimer = null;

  const chatContextMenu = document.getElementById('chatContextMenu');
  const chatContextMenuBackdrop = document.getElementById('chatContextMenuBackdrop');
  const ctxBtnReply = document.getElementById('ctxBtnReply');
  const ctxBtnCopy = document.getElementById('ctxBtnCopy');
  const chatReplyBar = document.getElementById('chatReplyBar');
  const replyBarTitle = document.getElementById('replyBarTitle');
  const replyBarText = document.getElementById('replyBarText');
  const btnCancelReply = document.getElementById('btnCancelReply');

  const closeContextMenu = () => {
    if (chatContextMenu) chatContextMenu.style.display = 'none';
  };

  const openContextMenu = (msgEl) => {
    activeTargetMsg = msgEl;
    if (chatContextMenu) chatContextMenu.style.display = 'flex';
  };

  const setReply = (title, text) => {
    activeReplyData = { title, text };
    if (replyBarTitle) replyBarTitle.textContent = title;
    if (replyBarText) replyBarText.textContent = text;
    if (chatReplyBar) chatReplyBar.style.display = 'flex';
    supportChatInput.focus();
  };

  const cancelReply = () => {
    activeReplyData = null;
    if (chatReplyBar) chatReplyBar.style.display = 'none';
  };

  if (btnCancelReply) {
    btnCancelReply.addEventListener('click', cancelReply);
  }

  if (chatContextMenuBackdrop) {
    chatContextMenuBackdrop.addEventListener('click', closeContextMenu);
  }

  if (ctxBtnCopy) {
    ctxBtnCopy.addEventListener('click', async () => {
      if (activeTargetMsg) {
        const textEl = activeTargetMsg.querySelector('.message-text');
        const cleanText = textEl ? textEl.innerText.trim() : '';
        if (cleanText) {
          await copyWithFeedback(cleanText, 'Текст скопирован');
        }
      }
      closeContextMenu();
    });
  }

  if (ctxBtnReply) {
    ctxBtnReply.addEventListener('click', () => {
      if (activeTargetMsg) {
        const isSupport = activeTargetMsg.classList.contains('in');
        const senderTitle = isSupport ? '👻 Support' : 'Вы';
        const textEl = activeTargetMsg.querySelector('.message-text');
        const snippet = textEl ? textEl.innerText.trim() : (activeTargetMsg.querySelector('img') ? '📷 Фотография' : '🎥 Видео');
        setReply(senderTitle, snippet);
      }
      closeContextMenu();
    });
  }

  // Long-press and Context menu triggers on messages
  supportChatHistory.addEventListener('contextmenu', (e) => {
    const msgEl = e.target.closest('.chat-message');
    if (msgEl) {
      e.preventDefault();
      openContextMenu(msgEl);
    }
  });

  supportChatHistory.addEventListener('touchstart', (e) => {
    const msgEl = e.target.closest('.chat-message');
    if (msgEl) {
      touchTimer = setTimeout(() => {
        openContextMenu(msgEl);
      }, 450);
    }
  }, { passive: true });

  supportChatHistory.addEventListener('touchend', () => {
    if (touchTimer) clearTimeout(touchTimer);
  });

  supportChatHistory.addEventListener('touchmove', () => {
    if (touchTimer) clearTimeout(touchTimer);
  });

  const getReplyQuoteHtml = () => {
    if (!activeReplyData) return '';
    const quoteHtml = `
      <div class="message-reply-quote">
        <div class="reply-quote-title">${activeReplyData.title}</div>
        <div class="reply-quote-text">${activeReplyData.text}</div>
      </div>
    `;
    cancelReply();
    return quoteHtml;
  };

  const sendMessage = () => {
    const text = supportChatInput.value.trim();
    if (!text) return;

    // Auto-format time
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    // Escape HTML to prevent XSS / UI breaks
    const safeText = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, '<br>');
    
    const replyQuote = typeof getReplyQuoteHtml === 'function' ? getReplyQuoteHtml() : '';

    const msgHtml = `
      <div class="chat-message out">
        ${replyQuote}
        <div class="message-text">${safeText}</div>
        <div class="message-meta">
          <span class="message-time">${timeString}</span>
          <svg class="message-status-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
      </div>
    `;
    
    const liveTypingIndicator = document.getElementById('supportTypingIndicator');
    const historyContainer = document.getElementById('supportChatHistory');

    if (liveTypingIndicator && liveTypingIndicator.parentNode === historyContainer) {
      liveTypingIndicator.insertAdjacentHTML('beforebegin', msgHtml);
    } else if (historyContainer) {
      historyContainer.insertAdjacentHTML('beforeend', msgHtml);
    }

    supportChatInput.value = '';
    if (historyContainer) {
      historyContainer.scrollTo({
        top: historyContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  };
  
  btnSupportChatSend.addEventListener('click', sendMessage);
  
  supportChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// Admin Tickets Navigation & Search Logic
const adminTicketList = document.getElementById('adminTicketList');
const adminChatView = document.getElementById('adminChatView');
const btnAdminBackToList = document.getElementById('btnAdminBackToList');
const btnAdminCloseTicket = document.getElementById('btnAdminCloseTicket');
const adminUserSearchInput = document.getElementById('adminUserSearchInput');
const btnAdminNewTicket = document.getElementById('btnAdminNewTicket');
const adminUsersDropdown = document.getElementById('adminUsersDropdown');
const adminActiveTitle = document.getElementById('adminActiveTitle');
const adminActiveIdBadge = document.getElementById('adminActiveIdBadge');
let currentActiveCard = null;

if (adminTicketList && adminChatView) {
  // Dynamic Ticket Count Recalculation
  const updateTicketCounts = () => {
    const allCards = document.querySelectorAll('.admin-ticket-card');
    const closedCards = document.querySelectorAll('.admin-ticket-card.is-closed');
    const activeCount = allCards.length - closedCards.length;
    const closedCount = closedCards.length;

    const filterBtns = document.querySelectorAll('.admin-filter-btn');
    filterBtns.forEach(btn => {
      const filter = btn.dataset.filter;
      if (filter === 'all') btn.textContent = `Все (${allCards.length})`;
      if (filter === 'active') btn.textContent = `Открытые (${activeCount})`;
      if (filter === 'closed') btn.textContent = `Закрытые (${closedCount})`;
    });
  };

  // Sample Messages per client to simulate real DB loading
  const sampleMessages = {
    '@alex_ghost': [
      { sender: '👤 @alex_ghost', text: 'Здравствуйте! У меня не подключается VPN на iPhone 15 после обновления...', time: '19:54', type: 'in' }
    ],
    '@maria_vpn': [
      { sender: '👤 @maria_vpn', text: 'Здравствуйте! Как продлить подписку на 3 месяца?', time: '18:30', type: 'in' }
    ],
    '@dmitry_tech': [
      { sender: '👤 @dmitry_tech', text: 'Здравствуйте! Всё настроил по вашей инструкции.', time: 'Вчера', type: 'in' },
      { sender: '👻 Support', text: 'Отлично! Рады были помочь.', time: 'Вчера', type: 'out' }
    ],
    '@sergey_ghost': [
      { sender: '👤 @sergey_ghost', text: 'Добрый вечер! Подскажите, где посмотреть конфигурацию V2Ray?', time: '20:10', type: 'in' }
    ]
  };

  const loadTicketHistory = (username, isClosed, snippet) => {
    if (!supportChatHistory) return;

    const msgs = sampleMessages[username] || [
      { sender: `👤 ${username}`, text: snippet || 'Здравствуйте! Нужна помощь с настройкой.', time: 'Только что', type: 'in' }
    ];

    let html = `<div class="chat-date-divider"><span>Сегодня</span></div>`;
    msgs.forEach(m => {
      if (m.type === 'in') {
        html += `
          <div class="chat-message in">
            <div class="message-sender">${m.sender}</div>
            <div class="message-text">${m.text}</div>
            <div class="message-meta"><span class="message-time">${m.time}</span></div>
          </div>
        `;
      } else {
        html += `
          <div class="chat-message out">
            <div class="message-text">${m.text}</div>
            <div class="message-meta"><span class="message-time">${m.time}</span></div>
          </div>
        `;
      }
    });

    if (isClosed) {
      html += `<div class="chat-system-notice">🔒 Тикет закрыт оператором</div>`;
    }

    html += `
      <div class="chat-typing-indicator" id="supportTypingIndicator" style="display:none;">
        <span class="typing-ghost">👤</span>
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </div>
    `;

    supportChatHistory.innerHTML = html;
    supportChatHistory.scrollTop = supportChatHistory.scrollHeight;
  };

  // Ticket Card click -> Open Chat with Client
  document.querySelectorAll('.admin-ticket-card').forEach(card => {
    card.addEventListener('click', () => {
      currentActiveCard = card;
      const username = card.dataset.username || '@client';
      const userId = card.dataset.userId || '00000';
      const snippetEl = card.querySelector('.ticket-snippet');
      const snippet = snippetEl ? snippetEl.textContent : '';

      if (adminActiveTitle) adminActiveTitle.textContent = username;
      if (adminActiveIdBadge) adminActiveIdBadge.textContent = `ID: ${userId}`;

      const isClosed = card.classList.contains('is-closed');
      if (supportChatInput) {
        supportChatInput.disabled = isClosed;
        supportChatInput.placeholder = isClosed ? 'Тикет закрыт' : 'Ответ клиенту...';
      }

      if (btnAdminCloseTicket) {
        btnAdminCloseTicket.style.opacity = isClosed ? '0.5' : '1';
      }

      loadTicketHistory(username, isClosed, snippet);

      adminTicketList.style.display = 'none';
      adminChatView.style.display = 'flex';
    });
  });

  // Back button -> Return to Ticket List
  if (btnAdminBackToList) {
    btnAdminBackToList.addEventListener('click', () => {
      adminChatView.style.display = 'none';
      adminTicketList.style.display = 'flex';
    });
  }

  // Close Ticket button -> Toast, system notice, lock input, mark closed & return to list
  if (btnAdminCloseTicket) {
    btnAdminCloseTicket.addEventListener('click', () => {
      if (currentActiveCard && currentActiveCard.classList.contains('is-closed')) {
        showToast('Тикет уже закрыт');
        return;
      }

      if (supportChatHistory) {
        const noticeHtml = `<div class="chat-system-notice">🔒 Тикет закрыт оператором</div>`;
        supportChatHistory.insertAdjacentHTML('beforeend', noticeHtml);
        supportChatHistory.scrollTo({ top: supportChatHistory.scrollHeight, behavior: 'smooth' });
      }

      if (supportChatInput) {
        supportChatInput.disabled = true;
        supportChatInput.placeholder = 'Тикет закрыт';
      }

      if (currentActiveCard) {
        currentActiveCard.classList.add('is-closed');
        const bottomRow = currentActiveCard.querySelector('.ticket-bottom-row');
        if (bottomRow) {
          const badge = bottomRow.querySelector('.ticket-unread-badge');
          if (badge) badge.remove();
          if (!bottomRow.querySelector('.ticket-status-tag')) {
            bottomRow.insertAdjacentHTML('beforeend', '<span class="ticket-status-tag">Закрыт</span>');
          }
        }
      }

      updateTicketCounts();
      showToast('Тема успешно закрыта ✅');

      // Return to list after short delay
      setTimeout(() => {
        adminChatView.style.display = 'none';
        adminTicketList.style.display = 'flex';
      }, 500);
    });
  }

  // Search User & Dropdown Toggle
  if (adminUserSearchInput && adminUsersDropdown) {
    adminUserSearchInput.addEventListener('focus', () => {
      adminUsersDropdown.style.display = 'block';
    });

    adminUserSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      adminUsersDropdown.style.display = query ? 'block' : 'none';
      
      const dropdownItems = document.querySelectorAll('.dropdown-user-item');
      dropdownItems.forEach(item => {
        const username = (item.dataset.username || '').toLowerCase();
        const userId = (item.dataset.userId || '').toLowerCase();
        if (username.includes(query) || userId.includes(query)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });

      const cards = document.querySelectorAll('.admin-ticket-card');
      cards.forEach(card => {
        const username = (card.dataset.username || '').toLowerCase();
        const userId = (card.dataset.userId || '').toLowerCase();
        if (username.includes(query) || userId.includes(query)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }

  // Select User from Dropdown
  document.querySelectorAll('.dropdown-user-item').forEach(item => {
    item.addEventListener('click', () => {
      const username = item.dataset.username;
      const userId = item.dataset.userId;

      if (adminActiveTitle) adminActiveTitle.textContent = username;
      if (adminActiveIdBadge) adminActiveIdBadge.textContent = `ID: ${userId}`;
      if (adminUsersDropdown) adminUsersDropdown.style.display = 'none';
      if (adminUserSearchInput) adminUserSearchInput.value = '';

      if (supportChatInput) {
        supportChatInput.disabled = false;
        supportChatInput.placeholder = 'Ответ клиенту...';
      }

      loadTicketHistory(username, false, '');

      adminTicketList.style.display = 'none';
      adminChatView.style.display = 'flex';
    });
  });

  // Filter Tabs (Все / Открытые / Закрытые)
  const filterBtns = document.querySelectorAll('.admin-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const filter = btn.dataset.filter;
      const cards = document.querySelectorAll('.admin-ticket-card');

      cards.forEach(card => {
        const isClosed = card.classList.contains('is-closed');
        if (filter === 'all') {
          card.style.display = 'flex';
        } else if (filter === 'active') {
          card.style.display = isClosed ? 'none' : 'flex';
        } else if (filter === 'closed') {
          card.style.display = isClosed ? 'flex' : 'none';
        }
      });
    });
  });

  // New Ticket button
  if (btnAdminNewTicket) {
    btnAdminNewTicket.addEventListener('click', () => {
      if (adminUsersDropdown) {
        adminUsersDropdown.style.display = adminUsersDropdown.style.display === 'none' ? 'block' : 'none';
      }
      if (adminUserSearchInput) adminUserSearchInput.focus();
    });
  }
}

// ==========================================
// Settings & Devices Management Logic
// ==========================================
const btnSettingsNotifications = document.getElementById('btnSettingsNotifications');
const btnSettingsPrivacy = document.getElementById('btnSettingsPrivacy');

const pagePrivacyPolicy = document.getElementById('page-privacy-policy');
const btnPrivacyBack = document.getElementById('btn-privacy-back');

// Notifications -> Eye-Level Popover
const notificationsPopover = document.getElementById('notificationsPopover');

if (btnSettingsNotifications && notificationsPopover) {
  btnSettingsNotifications.addEventListener('click', (e) => {
    e.stopPropagation();
    notificationsPopover.classList.toggle('visible');
    setTimeout(() => {
      notificationsPopover.classList.remove('visible');
    }, 2400);
  });

  document.addEventListener('click', () => {
    notificationsPopover.classList.remove('visible');
  });
}

// Privacy Policy -> Open Privacy Overlay
if (btnSettingsPrivacy && pagePrivacyPolicy) {
  btnSettingsPrivacy.addEventListener('click', () => {
    openOverlay(pagePrivacyPolicy);
  });
}

if (btnPrivacyBack && pagePrivacyPolicy) {
  btnPrivacyBack.addEventListener('click', () => {
    closeOverlay(pagePrivacyPolicy);
  });
}

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


};
})();
