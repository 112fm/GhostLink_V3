(function registerMockSupport(globalScope) {
  const STORAGE_KEY = 'ghostlink-v3-mock-support-chat-v2';

  function createMemoryStorage() {
    const values = new Map();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
    };
  }

  function createMockSupport(options = {}) {
    const storage = options.storage || (() => {
      try { return globalScope?.localStorage || null; } catch { return null; }
    })();
    const sessionStorage = options.sessionStorage || createMemoryStorage();
    const clock = options.now || (() => Date.now());
    let online = options.online !== false;
    let createCount = 0;

    function nowTs() {
      return Math.floor(Number(clock()) / 1000);
    }

    function readState() {
      for (const candidate of [sessionStorage, storage]) {
        try {
          const value = candidate?.getItem(STORAGE_KEY);
          if (value) return JSON.parse(value);
        } catch {
          // Restricted WebViews can reject storage; memory remains available.
        }
      }
      return { topics: {}, requestIndex: {} };
    }

    function writeState(state) {
      const value = JSON.stringify(state);
      for (const candidate of [sessionStorage, storage]) {
        try { candidate?.setItem(STORAGE_KEY, value); } catch { /* memory-only is valid locally */ }
      }
    }

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function transportError(type, requestId) {
      const error = new Error(type === 'timeout' ? 'Mock support request timed out.' : 'Mock support is offline.');
      error.type = type;
      error.request_id = requestId;
      return error;
    }

    function getLatestTopic(state) {
      return Object.values(state.topics)
        .sort((left, right) => right.created_ts - left.created_ts)[0] || null;
    }

    function publicTopic(topic) {
      if (!topic) return null;
      return clone({
        topic_id: topic.topic_id,
        status: topic.status,
        created_ts: topic.created_ts,
        closed_ts: topic.closed_ts || null,
        messages: topic.messages,
      });
    }

    function publicMessage(topic, message) {
      return clone({
        request_id: message.request_id,
        message_id: message.message_id,
        topic_id: topic.topic_id,
        topic_status: topic.status,
        status: message.status,
        message: message.text,
        created_ts: message.created_ts,
        error: message.error || null,
      });
    }

    return Object.freeze({
      async sendMessage({ request_id, message, scenario = 'success' } = {}) {
        const text = String(message || '').trim();
        if (!request_id || !text) {
          return { request_id: request_id || null, message_id: null, topic_id: null, topic_status: null, status: 'failed', message: null, created_ts: 0, error: { code: 'bad_request', message: 'Введите сообщение для поддержки.' } };
        }

        const state = readState();
        const known = state.requestIndex[request_id];
        if (known) {
          const topic = state.topics[known.topic_id];
          const savedMessage = topic?.messages.find((item) => item.message_id === known.message_id);
          if (topic && savedMessage) return publicMessage(topic, savedMessage);
        }

        let topic = getLatestTopic(state);
        if (!topic || topic.status === 'closed') {
          const suffix = request_id.replace(/[^a-z0-9]/gi, '').slice(-10);
          topic = {
            topic_id: `support-topic-${suffix || nowTs()}`,
            status: 'open',
            created_ts: nowTs(),
            closed_ts: null,
            messages: [],
          };
          state.topics[topic.topic_id] = topic;
        }

        const item = {
          request_id,
          message_id: `support-message-${request_id.replace(/[^a-z0-9]/gi, '').slice(-12) || nowTs()}`,
          author: 'client',
          status: 'sent',
          text,
          created_ts: nowTs(),
          error: null,
        };
        topic.messages.push(item);
        state.requestIndex[request_id] = { topic_id: topic.topic_id, message_id: item.message_id };
        writeState(state);
        createCount += 1;

        if (scenario === 'timeout') throw transportError('timeout', request_id);
        if (!online) throw transportError('network', request_id);
        return publicMessage(topic, item);
      },

      async addMockAdminReply(topicId, message) {
        const text = String(message || '').trim();
        const state = readState();
        const topic = state.topics[topicId];
        if (!topic || topic.status !== 'open' || !text) return null;
        topic.messages.push({
          request_id: null,
          message_id: `support-admin-${nowTs()}-${topic.messages.length + 1}`,
          author: 'admin',
          status: 'sent',
          text,
          created_ts: nowTs(),
          error: null,
        });
        writeState(state);
        return publicTopic(topic);
      },

      async closeTopic(topicId) {
        const state = readState();
        const topic = state.topics[topicId];
        if (!topic) return null;
        if (topic.status === 'closed') return publicTopic(topic);
        topic.status = 'closed';
        topic.closed_ts = nowTs();
        topic.messages.push({
          request_id: null,
          message_id: `support-system-close-${topic.topic_id}`,
          author: 'system',
          status: 'sent',
          text: 'Тему закрыли. Если понадобится помощь, отправьте новое сообщение.',
          created_ts: topic.closed_ts,
          error: null,
        });
        writeState(state);
        return publicTopic(topic);
      },

      async getTopic(topicId) {
        if (!online) throw transportError('network', topicId);
        return publicTopic(readState().topics[topicId]);
      },

      async getLatestTopic() {
        if (!online) throw transportError('network', null);
        return publicTopic(getLatestTopic(readState()));
      },

      setOnline(nextOnline) { online = Boolean(nextOnline); },
      getCreateCount: () => createCount,
    });
  }

  const exported = { createMockSupport };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    globalScope.GhostLinkV3.createMockSupport = createMockSupport;
  }
})(typeof window !== 'undefined' ? window : globalThis);
