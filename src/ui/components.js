(() => {
const GhostLinkV3 = window.GhostLinkV3 = window.GhostLinkV3 || {};

function createComponent(render) {
  return { render };
}

function createToast(toastElement) {
  let timer;

  return {
    show(message) {
      if (!toastElement) return;
      toastElement.textContent = message;
      toastElement.classList.add("is-visible");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => toastElement.classList.remove("is-visible"), 2200);
    },
  };
}

function createClipboard() {
  return async function copyText(value) {
    const text = String(value || "").trim();
    if (!text) return false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {
      // Telegram WebView may expose Clipboard API but reject the write.
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      return Boolean(document.execCommand?.("copy"));
    } catch (_) {
      return false;
    } finally {
      textarea.remove();
    }
  };
}

Object.assign(GhostLinkV3, { createComponent, createToast, createClipboard });
})();
