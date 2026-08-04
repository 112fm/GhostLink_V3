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
