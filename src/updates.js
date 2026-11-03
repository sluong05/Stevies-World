// Keep long-lived installed windows current without interrupting an editor or timer.
export function watchAppUpdates({ serviceWorker, windowTarget, documentTarget, canReload, reload, now = Date.now }) {
  let controller = serviceWorker.controller;
  let pending = false;
  let reloading = false;
  let lastCheck = -Infinity;
  let checking = null;
  const visible = () => documentTarget.visibilityState !== 'hidden';
  const apply = () => {
    if (pending && !reloading && visible() && canReload()) {
      reloading = true;
      reload();
    }
  };
  serviceWorker.addEventListener('controllerchange', () => {
    const next = serviceWorker.controller;
    if (controller && next && next !== controller) pending = true;
    controller = next;
    apply();
  });
  const registration = serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => null);
  const check = (force = false) => {
    apply();
    if (checking) return checking;
    if (!visible() || (!force && now() - lastCheck < 60_000)) return Promise.resolve();
    lastCheck = now();
    checking = registration.then(reg => reg?.update()).catch(() => {}).finally(() => { checking = null; });
    return checking;
  };
  windowTarget.addEventListener('focus', () => { check(); });
  windowTarget.addEventListener('online', () => { check(true); });
  windowTarget.addEventListener('hashchange', apply);
  documentTarget.addEventListener('visibilitychange', () => { if (visible()) check(); });
  // Also resume a deferred update after leaving a focused field on a browsing page.
  documentTarget.addEventListener('focusout', () => queueMicrotask(apply));
  check();
  return { check };
}
