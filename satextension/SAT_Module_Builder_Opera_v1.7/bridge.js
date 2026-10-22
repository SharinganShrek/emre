window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const d = event.data;
  if (!d || d.source !== 'sat-rw-module-builder' || d.type !== 'auth-captured') return;
  const a = d.auth || {};
  if (!a.authenticationToken || !a.authorizationToken) return;
  chrome.runtime.sendMessage({
    type: 'pageAuthCaptured',
    auth: a,
    capturedFrom: d.url || location.href,
    capturedAt: d.capturedAt || Date.now()
  }).catch(() => {});
});
