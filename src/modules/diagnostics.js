(function initDiagnosticsScope(root) {
  const GhostLinkV3 = root.GhostLinkV3 = root.GhostLinkV3 || {};

  function isEnabled(locationRef = root.location) {
    return new URLSearchParams(locationRef?.search || '').get('diagnostics') === '1';
  }

  function statusLabel(value) {
    if (value === 200) return '200';
    if (value === 'not_started') return 'Не начато';
    if (value === 'auth') return 'Нет входа';
    if (value === 'timeout') return 'Таймаут';
    if (value === 'network') return 'Нет сети';
    if (Number.isFinite(Number(value))) return String(value);
    return value ? 'Ошибка' : 'Не начато';
  }

  function setStatus(documentRef, id, value) {
    const element = documentRef.getElementById(id);
    if (!element) return;
    element.textContent = statusLabel(value);
    element.classList.toggle('is-ok', value === 200 || value === true);
    element.classList.toggle('is-error', value !== 'not_started' && value !== 200 && value !== true);
  }

  function setInitDataStatus(documentRef, present, elapsed) {
    const element = documentRef.getElementById('diagnostics-init-data');
    if (!element) return;
    const resolved = present === true || elapsed >= 3000;
    element.textContent = present === true ? 'Получен' : (resolved ? 'Не получен' : 'Проверяем…');
    element.classList.toggle('is-ok', present === true);
    element.classList.toggle('is-error', resolved && present !== true);
  }

  function initDiagnosticsModule({ profileSubscription, documentRef = root.document } = {}) {
    if (!isEnabled() || !documentRef || !profileSubscription?.getDiagnostics) return null;

    const page = documentRef.getElementById('page-diagnostics');
    const note = documentRef.getElementById('diagnostics-note');
    if (!page || !note) return null;

    page.classList.remove('hidden');

    const startedAt = Date.now();
    let intervalId = null;
    const stop = () => {
      if (intervalId !== null) root.clearInterval(intervalId);
      intervalId = null;
    };
    const refresh = () => {
      const diagnostics = profileSubscription.getDiagnostics();
      const elapsed = Date.now() - startedAt;
      setInitDataStatus(documentRef, diagnostics?.initData_present === true, elapsed);
      setStatus(documentRef, 'diagnostics-session', diagnostics?.session_status || 'not_started');
      setStatus(documentRef, 'diagnostics-user', diagnostics?.user_status || 'not_started');
      setStatus(documentRef, 'diagnostics-tariffs', diagnostics?.tariffs_status || 'not_started');

      const completed = diagnostics && diagnostics.session_status !== 'not_started'
        && diagnostics.user_status !== 'not_started' && diagnostics.tariffs_status !== 'not_started';
      const finished = completed || elapsed >= 10500;
      note.textContent = finished
        ? `Проверка завершена за ${Math.round(elapsed / 100) / 10} с.`
        : `Проверяем запуск: ${Math.min(10, Math.round(elapsed / 100) / 10)} с из 10 с.`;
      if (finished) stop();
    };

    documentRef.getElementById('btn-diagnostics-close')?.addEventListener('click', () => {
      stop();
      page.classList.add('hidden');
    });
    intervalId = root.setInterval(refresh, 150);
    refresh();
    return { refresh };
  }

  const exported = { initDiagnosticsModule, isDiagnosticsEnabled: isEnabled };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  Object.assign(GhostLinkV3, exported);
})(typeof window !== 'undefined' ? window : globalThis);
