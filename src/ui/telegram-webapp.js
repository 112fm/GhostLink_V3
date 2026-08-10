(function registerTelegramWebApp(globalScope) {
  function initTelegramWebApp(scope = globalScope) {
    const webApp = scope?.Telegram?.WebApp;
    if (!webApp) return null;

    try {
      webApp.ready?.();
    } catch (_) {
      // The app still renders an honest auth state if the SDK is unavailable.
    }
    try {
      webApp.expand?.();
    } catch (_) {
      // Expanding is cosmetic and must never block authentication.
    }
    return webApp;
  }

  const exported = { initTelegramWebApp };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    Object.assign(globalScope.GhostLinkV3, exported);
  }
})(typeof window !== 'undefined' ? window : globalThis);
