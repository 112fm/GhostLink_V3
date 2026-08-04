(() => {
  const GhostLinkV3 = window.GhostLinkV3 = window.GhostLinkV3 || {};

  GhostLinkV3.initInvitesModule = function initInvitesModule(dependencies = {}) {
    const { copyText, invites } = dependencies;
    if (!invites) return;

    const refs = {
      statsToggle: document.getElementById('refStatsToggle'),
      statsDrawer: document.getElementById('refStatsDrawer'),
      rewardDays: document.getElementById('refRewardDaysNum'),
      chain: document.getElementById('refChainContainer'),
      subscribed: document.getElementById('drawerSubscribed'),
      pending: document.getElementById('drawerPending'),
      expired: document.getElementById('drawerExpired'),
      modeStandard: document.getElementById('btnModeStandard'),
      modeBridge: document.getElementById('btnModeBridge'),
      title: document.getElementById('refLinkTitle'),
      subtitle: document.getElementById('refLinkSubtitle'),
      linkBox: document.getElementById('refLinkBox'),
      linkText: document.getElementById('refLinkText'),
      share: document.getElementById('btnShareReferral'),
      shareText: document.getElementById('btnShareText'),
      shareIcon: document.getElementById('btnShareIcon'),
      keyIcon: document.getElementById('btnKeyIcon'),
      toggleQr: document.getElementById('btnToggleQr'),
      qrBox: document.getElementById('bridgeQrContainer'),
      qrStub: document.getElementById('refQrStub'),
      qrLabel: document.getElementById('refQrLabel'),
      wizard: document.getElementById('bridgeWizardBox'),
      wizardHint: document.getElementById('wizardHintText'),
      wizardNext: document.getElementById('btnWizardNext'),
      wizardNextText: document.getElementById('btnWizardNextText'),
      timeline: document.getElementById('bridgeTimeline'),
      steps: [
        document.getElementById('bStep1'),
        document.getElementById('bStep2'),
        document.getElementById('bStep3'),
        document.getElementById('bStep4'),
      ],
      error: document.getElementById('bStep1ErrMsg'),
      list: document.getElementById('refFriendsList'),
      count: document.querySelector('.invited-count-badge'),
      toast: document.getElementById('refToast'),
    };

    const modes = {
      standard: {
        title: 'Пригласи друга',
        subtitle: 'Отправь ссылку и получи бонусные дни после первой оплаты друга.',
        button: 'Поделиться ссылкой',
      },
      bridge: {
        title: 'Пригласи друга (Мост 2.0)',
        subtitle: 'Локальная проверка сценария. Настоящий ключ и привязка пользователя появятся только после серверного контракта Bridge.',
        button: 'Подготовить mock-ссылку',
      },
    };
    const state = {
      mode: 'standard',
      snapshot: null,
      bridge: { requestId: null, operation: null, busy: false },
    };
    let toastTimer;

    function notify(message) {
      if (!refs.toast) return;
      refs.toast.textContent = message;
      refs.toast.classList.add('show');
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => refs.toast.classList.remove('show'), 2600);
    }

    function bridgeRequestId() {
      if (window.crypto?.randomUUID) return `bridge-${window.crypto.randomUUID()}`;
      return `bridge-${Date.now()}-${Math.random().toString(16).slice(2, 12)}`;
    }

    function setHidden(element, hidden) {
      element?.classList.toggle('hidden', hidden);
    }

    function setBridgeBusy(busy) {
      state.bridge.busy = busy;
      if (refs.share) refs.share.disabled = busy;
      if (refs.toggleQr) refs.toggleQr.disabled = busy;
      if (refs.wizardNext) refs.wizardNext.disabled = busy;
    }

    function setTimeline(statuses = [], errorMessage = '') {
      setHidden(refs.timeline, false);
      refs.steps.forEach((step, index) => {
        if (step) step.className = `timeline-step ${statuses[index] || ''}`;
      });
      if (refs.error) {
        refs.error.textContent = errorMessage;
        setHidden(refs.error, !errorMessage);
      }
    }

    function resetBridgeUi() {
      state.bridge = { requestId: null, operation: null, busy: false };
      setHidden(refs.qrBox, true);
      refs.toggleQr?.classList.remove('active');
      setHidden(refs.wizard, true);
      setHidden(refs.timeline, true);
      setHidden(refs.error, true);
      setBridgeBusy(false);
    }

    function getBridgeQrValue() {
      const operation = state.bridge.operation;
      if (!operation) return '';
      return operation.status === 'created' ? operation.temporary_key : operation.invite_url;
    }

    function renderLocalMockQr(value) {
      if (!refs.qrStub) return;
      // This is deliberately a local visual mock, not a scannable QR or a real key.
      // A real QR encoder will be added with the approved server Bridge contract.
      let seed = 0;
      for (const character of value) seed = ((seed * 31) + character.charCodeAt(0)) >>> 0;
      const size = 25;
      const cells = [];
      const finder = (x, y, startX, startY) => {
        const dx = x - startX;
        const dy = y - startY;
        return dx >= 0 && dx < 7 && dy >= 0 && dy < 7
          && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      };
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const reserved = finder(x, y, 1, 1) || finder(x, y, size - 8, 1) || finder(x, y, 1, size - 8);
          seed = (seed * 1664525 + 1013904223) >>> 0;
          if (reserved || (seed & 3) === 0) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
        }
      }
      refs.qrStub.dataset.qrValue = value;
      refs.qrStub.innerHTML = `<svg class="mock-qr" viewBox="0 0 ${size} ${size}" role="img" aria-label="Локальный mock QR-код"><rect width="${size}" height="${size}" fill="#fff"/>${cells.join('')}</svg>`;
    }

    function showQr() {
      const value = state.mode === 'bridge' ? getBridgeQrValue() : state.snapshot?.standardInvitation?.url;
      if (!value) return;
      renderLocalMockQr(value);
      setHidden(refs.qrBox, false);
      refs.toggleQr?.classList.add('active');
      if (refs.qrLabel) {
        refs.qrLabel.textContent = state.mode === 'bridge'
          ? 'Локальный mock-QR использует текущую подготовленную ссылку. Реальный QR появится после подключения Bridge API.'
          : 'Локальный mock-QR использует текущую реферальную ссылку.';
      }
    }

    function renderChain(rewardDays) {
      if (!refs.chain) return;
      const milestones = [14, 28, 42, 56, '∞'];
      refs.chain.innerHTML = `<div class="chain-nodes-row">${milestones.map((milestone, index) => {
        const target = milestone === '∞' ? 56 : milestone;
        const active = rewardDays >= target;
        const node = `<div class="chain-node-item ${active ? 'active' : ''}"><div class="node-medallion ${milestone === '∞' ? 'infinity' : ''}">${active ? '●' : (milestone === '∞' ? '∞' : '')}</div><span class="node-label">+${milestone}</span></div>`;
        const next = milestones[index + 1];
        const line = next ? `<div class="chain-line ${rewardDays >= (next === '∞' ? 56 : next) ? 'active' : ''}"></div>` : '';
        return node + line;
      }).join('')}</div>`;
    }

    function invitationView(invitation) {
      const status = {
        subscribed: ['Подписка оформлена', '+14 дней', 'granted'],
        pending: ['Пробный период', 'Ожидаем оплату', 'pending'],
        expired: ['Не пользуется', '', ''],
      }[invitation.status] || ['Статус неизвестен', '', ''];
      return `<div class="feed-item" data-user="${invitation.id}">
        <div class="feed-item-top"><div class="feed-user-info"><span class="user-name">${invitation.name}</span><span class="user-handle">${invitation.handle || ''}</span></div><div class="feed-right-group"><span class="feed-time">${invitation.createdAt}</span></div></div>
        <div class="feed-item-bottom"><span class="feed-status-text">${status[0]}</span>${status[1] ? `<span class="feed-note ${status[2]}">${status[1]}</span>` : ''}</div>
      </div>`;
    }

    function renderSnapshot(snapshot) {
      state.snapshot = snapshot;
      const { stats } = snapshot;
      if (refs.rewardDays) refs.rewardDays.textContent = `+${stats.rewardDays}`;
      if (refs.subscribed) refs.subscribed.textContent = String(stats.subscribed);
      if (refs.pending) refs.pending.textContent = String(stats.pending);
      if (refs.expired) refs.expired.textContent = String(stats.expired);
      if (refs.count) refs.count.textContent = stats.invited ? `${stats.invited} приглашения` : 'Пока нет приглашений';
      renderChain(stats.rewardDays);
      if (refs.list) {
        refs.list.innerHTML = snapshot.invitations.length
          ? snapshot.invitations.map(invitationView).join('')
          : '<div class="referral-empty-card"><strong class="empty-title">Пока нет приглашений</strong><span class="empty-subtitle">Отправьте ссылку другу, чтобы здесь появилась его заявка.</span></div>';
      }
      if (state.mode === 'standard' && refs.linkText) refs.linkText.textContent = snapshot.standardInvitation.url;
    }

    async function loadSnapshot() {
      try {
        renderSnapshot(await invites.getSnapshot());
      } catch (error) {
        notify(error.type === 'network' ? 'Статистика приглашений временно недоступна.' : 'Не удалось обновить локальные приглашения.');
      }
    }

    function renderMode(mode) {
      state.mode = mode;
      resetBridgeUi();
      const config = modes[mode];
      refs.modeStandard?.classList.toggle('active', mode === 'standard');
      refs.modeBridge?.classList.toggle('active', mode === 'bridge');
      if (refs.title) refs.title.textContent = config.title;
      if (refs.subtitle) refs.subtitle.textContent = config.subtitle;
      if (refs.shareText) refs.shareText.textContent = config.button;
      refs.shareIcon?.classList.toggle('hidden', mode === 'bridge');
      refs.keyIcon?.classList.toggle('hidden', mode !== 'bridge');
      if (mode === 'standard') {
        setHidden(refs.linkBox, false);
        if (refs.linkText) refs.linkText.textContent = state.snapshot?.standardInvitation?.url || '';
      } else {
        setHidden(refs.linkBox, true);
        restoreLatestBridge();
      }
    }

    function renderBridgeOperation(operation) {
      if (!operation) return;
      state.bridge.requestId = operation.request_id;
      state.bridge.operation = operation;
      setHidden(refs.linkBox, false);
      setHidden(refs.wizard, false);
      if (refs.wizardNext) refs.wizardNext.disabled = false;

      if (operation.status === 'created') {
        if (refs.linkText) refs.linkText.textContent = operation.temporary_key || 'Временная ссылка пока не готова.';
        if (refs.wizardHint) refs.wizardHint.textContent = `Временная mock-ссылка действует до ${new Date(operation.expires_ts * 1000).toLocaleString('ru-RU')}. Копирование само по себе не меняет статус.`;
        if (refs.wizardNextText) refs.wizardNextText.textContent = 'Отметить передачу (mock)';
        setTimeline(['active', '', '', '']);
        return;
      }
      if (operation.status === 'transferred') {
        if (refs.linkText) refs.linkText.textContent = operation.invite_url || 'Приглашение пока не готово.';
        if (refs.wizardHint) refs.wizardHint.textContent = 'Mock-передача отмечена. Далее локально запускаем ожидание вступления. Реальное получение сервер подтвердит позже.';
        if (refs.wizardNextText) refs.wizardNextText.textContent = 'Начать ожидание вступления (mock)';
        setTimeline(['complete', 'active', '', '']);
        return;
      }
      if (operation.status === 'waiting_join') {
        if (refs.linkText) refs.linkText.textContent = operation.invite_url || 'Приглашение ожидает вступления.';
        if (refs.wizardHint) refs.wizardHint.textContent = 'Ожидаем вступление приглашённого. Для локальной проверки можно смоделировать подтверждение отдельно.';
        if (refs.wizardNextText) refs.wizardNextText.textContent = 'Смоделировать вступление (mock)';
        setTimeline(['complete', 'complete', 'active', '']);
        return;
      }
      if (operation.status === 'bound') {
        if (refs.linkText) refs.linkText.textContent = operation.invite_url || 'Приглашение закреплено.';
        if (refs.wizardHint) refs.wizardHint.textContent = `Mock-приглашение закреплено за ${operation.bound_user_id}. Второй ключ не создавался.`;
        if (refs.wizardNextText) refs.wizardNextText.textContent = 'Ключ закреплён (mock)';
        if (refs.wizardNext) refs.wizardNext.disabled = true;
        setTimeline(['complete', 'complete', 'complete', 'complete']);
        return;
      }
      if (operation.status === 'expired') {
        if (refs.linkText) refs.linkText.textContent = 'Срок временной mock-ссылки истёк.';
        if (refs.wizardHint) refs.wizardHint.textContent = 'Срок 24 часа истёк. Временная ссылка недействительна и не может быть закреплена.';
        if (refs.wizardNextText) refs.wizardNextText.textContent = 'Срок истёк';
        if (refs.wizardNext) refs.wizardNext.disabled = true;
        setTimeline(['complete', 'complete', 'complete', 'error'], 'Срок временного доступа истёк.');
        return;
      }
      if (refs.linkText) refs.linkText.textContent = 'Bridge-операция завершилась ошибкой.';
      if (refs.wizardHint) refs.wizardHint.textContent = operation.error?.message || 'Не удалось безопасно завершить локальную Bridge-операцию.';
      if (refs.wizardNextText) refs.wizardNextText.textContent = 'Операция не выполнена';
      if (refs.wizardNext) refs.wizardNext.disabled = true;
      setTimeline(['error', '', '', ''], operation.error?.message || 'Локальная Bridge-операция завершилась ошибкой.');
    }

    async function restoreLatestBridge() {
      try {
        const operation = await invites.getLatestBridge();
        if (operation) renderBridgeOperation(operation);
      } catch (error) {
        notify(error.type === 'network' ? 'Не удалось проверить сохранённую Bridge-операцию.' : 'Локальная Bridge-операция временно недоступна.');
      }
    }

    async function startBridge() {
      if (state.bridge.busy) return;
      setBridgeBusy(true);
      try {
        const terminal = ['bound', 'expired', 'failed'].includes(state.bridge.operation?.status);
        const requestId = terminal ? bridgeRequestId() : (state.bridge.requestId || bridgeRequestId());
        state.bridge.requestId = requestId;
        const operation = await invites.createBridge({ request_id: requestId });
        renderBridgeOperation(operation);
        notify(operation.status === 'created' ? 'Временная mock-ссылка подготовлена.' : 'Восстановлена существующая Bridge-операция.');
      } catch (error) {
        setHidden(refs.wizard, false);
        setTimeline(['error', '', '', ''], error.type === 'timeout'
          ? 'Не получили ответ вовремя. Проверим ту же операцию при следующем открытии.'
          : 'Нет соединения. Новая операция не создаётся до проверки сохранённой.');
        if (refs.wizardHint) refs.wizardHint.textContent = 'Повторное нажатие проверит тот же request_id и не создаст второй mock-ключ.';
      } finally {
        setBridgeBusy(false);
      }
    }

    async function copyCurrentLink() {
      const value = refs.linkText?.textContent?.trim();
      if (!value) return;
      const copied = await copyText(value);
      notify(copied ? 'Ссылка скопирована. Статус Bridge не изменён.' : 'Не удалось скопировать. Нажмите и удерживайте ссылку.');
    }

    async function shareStandard() {
      const value = state.snapshot?.standardInvitation?.url;
      if (!value) return;
      const data = { title: 'GhostLink', text: 'Подключайся к GhostLink по моей ссылке:', url: value };
      if (navigator.share) {
        try {
          await navigator.share(data);
          notify('Окно отправки открыто.');
        } catch {
          // Closing a native share sheet is neutral, not an error.
        }
        return;
      }
      const copied = await copyText(value);
      notify(copied ? 'Ссылка скопирована для отправки.' : 'Не удалось скопировать. Нажмите и удерживайте ссылку.');
    }

    async function advanceBridge() {
      const operation = state.bridge.operation;
      if (!operation || state.bridge.busy) return;
      setBridgeBusy(true);
      try {
        let next;
        if (operation.status === 'created') next = await invites.markTransferred(operation.request_id);
        if (operation.status === 'transferred') next = await invites.markWaitingJoin(operation.request_id);
        if (operation.status === 'waiting_join') next = await invites.bindMockUser(operation.request_id);
        if (next) {
          renderBridgeOperation(next);
          if (!refs.qrBox?.classList.contains('hidden')) showQr();
        }
      } catch (error) {
        notify(error.type === 'network' ? 'Нет соединения. Проверим ту же Bridge-операцию позже.' : 'Не удалось обновить Bridge-статус.');
      } finally {
        setBridgeBusy(false);
      }
    }

    refs.statsToggle?.addEventListener('click', () => {
      const hidden = refs.statsDrawer?.classList.contains('hidden');
      setHidden(refs.statsDrawer, !hidden);
      refs.statsToggle.setAttribute('aria-expanded', String(Boolean(hidden)));
    });
    refs.modeStandard?.addEventListener('click', () => renderMode('standard'));
    refs.modeBridge?.addEventListener('click', () => renderMode('bridge'));
    refs.linkBox?.addEventListener('click', copyCurrentLink);
    refs.share?.addEventListener('click', () => (state.mode === 'bridge' ? startBridge() : shareStandard()));
    refs.toggleQr?.addEventListener('click', async () => {
      if (state.mode === 'bridge' && !state.bridge.operation) await startBridge();
      if (state.mode === 'standard' || state.bridge.operation) showQr();
    });
    refs.wizardNext?.addEventListener('click', advanceBridge);

    loadSnapshot();
    renderMode('standard');
  };
})();
