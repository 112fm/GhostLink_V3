(function initSupportScope(root) {
  const GhostLinkV3 = root.GhostLinkV3 = root.GhostLinkV3 || {};

  function createRequestId() {
    if (root.crypto?.randomUUID) return `support-${root.crypto.randomUUID()}`;
    return `support-${Date.now()}-${Math.random().toString(16).slice(2, 12)}`;
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function initSupportModule(dependencies = {}) {
    const documentRef = root.document;
    const support = dependencies.support || GhostLinkV3.createMockSupport?.();
    const showToast = dependencies.showToast || (() => {});
    const input = documentRef?.getElementById('supportChatInput');
    const sendButton = documentRef?.getElementById('btnSupportChatSend');
    const history = documentRef?.getElementById('supportChatHistory');
    const typing = documentRef?.getElementById('supportTypingIndicator');
    const status = documentRef?.getElementById('supportLocalStatus');
    if (!support || !input || !sendButton || !history) return null;

    const state = { topicId: null, pendingRequest: null, busy: false };

    function setStatus(message = '') {
      if (!status) return;
      status.textContent = message;
      status.hidden = !message;
    }

    function setBusy(busy) {
      state.busy = busy;
      sendButton.disabled = busy;
      sendButton.setAttribute('aria-busy', String(busy));
    }

    function clearDynamicMessages() {
      history.querySelectorAll('[data-support-message-id]').forEach((item) => item.remove());
    }

    function makeMessage(message) {
      const item = documentRef.createElement('article');
      item.dataset.supportMessageId = message.message_id;
      item.className = message.author === 'client'
        ? 'chat-message out'
        : message.author === 'system'
          ? 'chat-date-divider'
          : 'chat-message in';

      if (message.author === 'system') {
        const notice = documentRef.createElement('span');
        notice.textContent = message.text;
        item.append(notice);
        return item;
      }

      if (message.author === 'admin') {
        const sender = documentRef.createElement('div');
        sender.className = 'message-sender';
        sender.textContent = '👻 Support';
        item.append(sender);
      }

      const text = documentRef.createElement('div');
      text.className = 'message-text';
      text.textContent = message.text;

      const meta = documentRef.createElement('div');
      meta.className = 'message-meta';
      const time = documentRef.createElement('span');
      time.className = 'message-time';
      time.textContent = formatTime(message.created_ts);
      meta.append(time);

      if (message.author === 'client') {
        const localStatus = documentRef.createElement('span');
        localStatus.className = 'message-local-status';
        localStatus.textContent = 'Отправлено';
        meta.append(localStatus);
      }
      item.append(text, meta);
      return item;
    }

    function renderTopic(topic) {
      if (!topic) return;
      state.topicId = topic.topic_id;
      clearDynamicMessages();
      topic.messages.forEach((message) => typing?.before(makeMessage(message)));
      history.scrollTop = history.scrollHeight;
      setStatus(topic.status === 'closed'
        ? 'Тема закрыта. Новое сообщение откроет новую тему.'
        : 'Тема открыта. Ожидаем ответа поддержки.');
    }

    async function send() {
      const message = input.value.trim();
      if (!message) {
        setStatus('Введите сообщение, чтобы обратиться в поддержку.');
        return;
      }
      if (state.busy) return;

      const pending = state.pendingRequest;
      const requestId = pending?.message === message ? pending.requestId : createRequestId();
      state.pendingRequest = { requestId, message };
      setBusy(true);
      setStatus('Отправляем сообщение…');
      try {
        const result = await support.sendMessage({ request_id: requestId, message });
        if (result.status === 'failed') {
          setStatus(result.error?.message || 'Не удалось подготовить сообщение.');
          return;
        }
        state.pendingRequest = null;
        input.value = '';
        const topic = await support.getTopic(result.topic_id);
        renderTopic(topic);
      } catch (error) {
        const retryText = error?.type === 'timeout'
          ? 'Ответ задерживается. Повторите отправку: второе сообщение не создастся.'
          : 'Нет соединения. Повторите отправку, когда сеть появится.';
        setStatus(retryText);
        showToast(retryText);
      } finally {
        setBusy(false);
      }
    }

    async function restore() {
      try {
        renderTopic(await support.getLatestTopic());
      } catch {
        // Never claim an answer, close, or delivery state when local state is unavailable.
        setStatus('Не удалось проверить сохранённую тему.');
      }
    }

    sendButton.addEventListener('click', send);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    });
    restore();
    return { send, restore, state };
  }

  const exported = { initSupportModule, createSupportRequestId: createRequestId };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  Object.assign(GhostLinkV3, exported);
})(typeof window !== 'undefined' ? window : globalThis);
