(function registerTelegramSdkLoader(globalScope) {
  const EXTERNAL_SDK_URL = 'https://telegram.org/js/telegram-web-app.js';
  const FALLBACK_SDK_URL = './src/vendor/telegram-web-app.js?v=26';
  const DEFAULT_EXTERNAL_TIMEOUT_MS = 1500;
  const DEFAULT_FALLBACK_TIMEOUT_MS = 1500;

  function isReady(scope) {
    return Boolean(scope?.Telegram?.WebApp);
  }

  function loadScript(documentRef, source) {
    const script = documentRef.createElement('script');
    script.src = source;
    script.async = true;
    return script;
  }

  function loadTelegramSdk(options = {}) {
    const scope = options.scope || globalScope;
    const documentRef = options.documentRef || scope?.document;
    const setTimeoutImpl = options.setTimeoutImpl || scope?.setTimeout?.bind(scope) || globalScope.setTimeout.bind(globalScope);
    const clearTimeoutImpl = options.clearTimeoutImpl || scope?.clearTimeout?.bind(scope) || globalScope.clearTimeout.bind(globalScope);
    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Math.max(1, Number(options.timeoutMs)) : DEFAULT_EXTERNAL_TIMEOUT_MS;
    const fallbackTimeoutMs = Number.isFinite(Number(options.fallbackTimeoutMs))
      ? Math.max(1, Number(options.fallbackTimeoutMs))
      : DEFAULT_FALLBACK_TIMEOUT_MS;

    if (isReady(scope)) return Promise.resolve({ source: 'existing', ready: true });
    if (!documentRef?.head || typeof documentRef.createElement !== 'function') {
      return Promise.resolve({ source: 'unavailable', ready: false });
    }

    return new Promise((resolve) => {
      let settled = false;
      let externalTimer = null;
      let fallbackTimer = null;
      let externalScript = null;

      const finish = (source) => {
        if (settled) return;
        settled = true;
        if (externalTimer) clearTimeoutImpl(externalTimer);
        if (fallbackTimer) clearTimeoutImpl(fallbackTimer);
        resolve({ source, ready: isReady(scope) });
      };

      const loadFallback = () => {
        if (settled) return;
        if (externalTimer) clearTimeoutImpl(externalTimer);
        if (externalScript) {
          externalScript.onload = null;
          externalScript.onerror = null;
          externalScript.remove?.();
        }
        const fallbackScript = loadScript(documentRef, FALLBACK_SDK_URL);
        fallbackScript.onload = () => finish('fallback');
        fallbackScript.onerror = () => finish('unavailable');
        fallbackTimer = setTimeoutImpl(() => finish('unavailable'), fallbackTimeoutMs);
        documentRef.head.append(fallbackScript);
      };

      externalScript = loadScript(documentRef, EXTERNAL_SDK_URL);
      externalScript.onload = () => {
        if (isReady(scope)) finish('external');
        else loadFallback();
      };
      externalScript.onerror = loadFallback;
      externalTimer = setTimeoutImpl(loadFallback, timeoutMs);
      documentRef.head.append(externalScript);
    });
  }

  const exported = { loadTelegramSdk };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    Object.assign(globalScope.GhostLinkV3, exported);
  }
})(typeof window !== 'undefined' ? window : globalThis);
