(() => {
  const GhostLinkV3 = window.GhostLinkV3 || {};
  const { createClipboard, createToast, createOverlayNavigator } = GhostLinkV3;

  if (!createClipboard || !createToast || !createOverlayNavigator) {
    throw new Error("GhostLink V3 boot dependencies are missing");
  }

  const { show: showToast } = createToast(document.getElementById("toast"));
  const copyText = createClipboard();
  const overlayNavigator = createOverlayNavigator();
  GhostLinkV3.initTelegramWebApp?.(window);
  // Block 1 keeps credentials in memory only and reads profile data from the
  // confirmed API contract. The remaining modules intentionally stay mock.
  const profileSubscription = GhostLinkV3.createRealBlock1Adapter?.();
  if (!profileSubscription) {
    throw new Error("GhostLink V3 real Block 1 adapter is missing");
  }
  const deviceAdapter = GhostLinkV3.createRealDeviceAdapter?.({
    apiBase: profileSubscription.getApiBase?.(),
    getToken: () => profileSubscription.getToken?.(),
  });
  if (!deviceAdapter) {
    throw new Error("GhostLink V3 real device adapter is missing");
  }
  const invites = GhostLinkV3.createMockInvites?.();
  const support = GhostLinkV3.createMockSupport?.();
  const dependencies = {
    showToast,
    copyText,
    profileSubscription,
    deviceList: deviceAdapter,
    deviceOperations: deviceAdapter,
    deviceMutations: deviceAdapter,
    invites,
    support,
    openOverlay: (page) => overlayNavigator.open(page),
    closeOverlay: (page) => overlayNavigator.close(page),
    returnToHome: () => overlayNavigator.home(),
  };
  let adminRuntimeInitialized = false;

  function initVerifiedAdminRuntime(snapshot) {
    if (adminRuntimeInitialized || snapshot?.user?.is_admin !== true) return;
    adminRuntimeInitialized = true;
    const adminDependencies = { ...dependencies, isAdmin: true };
    try {
      GhostLinkV3.initAdminPaymentSettingsModule?.(adminDependencies);
    } catch (_) {
      // Admin-only setup cannot affect the client application lifecycle.
    }
    try {
      GhostLinkV3.initAdminModule?.(adminDependencies);
    } catch (_) {
      // Admin-only setup cannot affect the client application lifecycle.
    }
  }

  profileSubscription.subscribe?.(initVerifiedAdminRuntime);

  GhostLinkV3.initHomeModule?.(dependencies);
  GhostLinkV3.initDiagnosticsModule?.({ profileSubscription });
  GhostLinkV3.initSubscriptionModule?.(dependencies);
  GhostLinkV3.initDevicesModule?.(dependencies);
  try {
    GhostLinkV3.initInvitesModule?.(dependencies);
  } catch (_) {
    // Invites are secondary and must not interrupt the profile lifecycle.
  }
  GhostLinkV3.initSupportModule?.(dependencies);
  GhostLinkV3.initContextHelpModule?.(dependencies);
})();
