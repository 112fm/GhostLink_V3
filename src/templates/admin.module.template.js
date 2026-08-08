(() => {
const GhostLinkV3 = window.GhostLinkV3 = window.GhostLinkV3 || {};

GhostLinkV3.initAdminModule = function initAdminModule(dependencies = {}) {
  const { showToast, copyText, openOverlay, closeOverlay, returnToHome } = dependencies;

  async function copyWithFeedback(value, successMessage) {
    const copied = await copyText(value);
    showToast(copied ? successMessage : 'Не удалось скопировать. Нажмите и удерживайте текст.');
    return copied;
  }

/* @include src/modules/admin/support.js */
/* @include src/modules/admin/dashboard.js */
/* @include src/modules/admin/users.js */
/* @include src/modules/admin/finance.js */
/* @include src/modules/admin/partners.js */
/* @include src/modules/admin/system.js */

};
})();
