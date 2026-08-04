(() => {
  const GhostLinkV3 = window.GhostLinkV3 || {};
  const { createClipboard, createToast, createOverlayNavigator } = GhostLinkV3;

  if (!createClipboard || !createToast || !createOverlayNavigator) {
    throw new Error("GhostLink V3 boot dependencies are missing");
  }

  const { show: showToast } = createToast(document.getElementById("toast"));
  const copyText = createClipboard();
  const overlayNavigator = createOverlayNavigator();
  // Block 1 uses an in-memory adapter with the future session/profile response
  // shape. It never sends Telegram initData or keys to persistent browser storage.
  const profileSubscription = GhostLinkV3.createLocalBlock1Adapter?.()
    || GhostLinkV3.createMockProfileSubscription?.();
  // Block 2 maps the future /api/device/list shape in memory. It does not
  // retain raw device responses, UUIDs, or subscription URLs in browser storage.
  const deviceList = GhostLinkV3.createLocalDeviceListAdapter?.()
    || GhostLinkV3.createMockDeviceList?.();
  const invites = GhostLinkV3.createMockInvites?.();
  const support = GhostLinkV3.createMockSupport?.();
  const dependencies = {
    showToast,
    copyText,
    profileSubscription,
    deviceList,
    invites,
    support,
    openOverlay: (page) => overlayNavigator.open(page),
    closeOverlay: (page) => overlayNavigator.close(page),
    returnToHome: () => overlayNavigator.home(),
  };

  GhostLinkV3.initHomeModule?.(dependencies);
  GhostLinkV3.initSubscriptionModule?.(dependencies);
  GhostLinkV3.initDevicesModule?.(dependencies);
  GhostLinkV3.initInvitesModule?.(dependencies);
  GhostLinkV3.initSupportModule?.(dependencies);
  GhostLinkV3.initContextHelpModule?.(dependencies);
  GhostLinkV3.initAdminPaymentSettingsModule?.(dependencies);
  GhostLinkV3.initAdminModule?.(dependencies);
})();
