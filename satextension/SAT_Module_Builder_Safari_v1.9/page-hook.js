(() => {
  if (window.__satRwModuleBuilderHookInstalled) return;
  window.__satRwModuleBuilderHookInstalled = true;

  const AUTHN = 'x-cb-catapult-authentication-token';
  const AUTHZ = 'x-cb-catapult-authorization-token';

  function normalizeHeaders(input) {
    const out = {};
    try {
      const h = new Headers(input || {});
      h.forEach((v, k) => { out[String(k).toLowerCase()] = String(v); });
    } catch (_) {}
    return out;
  }

  function maybeEmit(headers, url) {
    const h = normalizeHeaders(headers);
    const authenticationToken = h[AUTHN];
    const authorizationToken = h[AUTHZ];
    if (!authenticationToken || !authorizationToken) return;
    window.postMessage({
      source: 'sat-rw-module-builder',
      type: 'auth-captured',
      auth: { authenticationToken, authorizationToken },
      url: String(url || ''),
      capturedAt: Date.now()
    }, window.location.origin);
  }

  // Capture fetch() requests in the actual page world. This is a fallback for
  // Chromium/Opera builds where extension webRequest does not expose custom headers.
  try {
    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = function(input, init) {
        try {
          const merged = new Headers();
          if (input instanceof Request) {
            input.headers.forEach((v, k) => merged.set(k, v));
          }
          if (init && init.headers) {
            new Headers(init.headers).forEach((v, k) => merged.set(k, v));
          }
          const url = input instanceof Request ? input.url : input;
          maybeEmit(merged, url);
        } catch (_) {}
        return originalFetch.apply(this, arguments);
      };
    }
  } catch (_) {}

  // Capture XMLHttpRequest requests as a second fallback.
  try {
    const proto = XMLHttpRequest.prototype;
    const originalOpen = proto.open;
    const originalSet = proto.setRequestHeader;
    const originalSend = proto.send;
    proto.open = function(method, url) {
      this.__satRwBuilderUrl = url;
      this.__satRwBuilderHeaders = {};
      return originalOpen.apply(this, arguments);
    };
    proto.setRequestHeader = function(name, value) {
      try { this.__satRwBuilderHeaders[String(name).toLowerCase()] = String(value); } catch (_) {}
      return originalSet.apply(this, arguments);
    };
    proto.send = function() {
      try { maybeEmit(this.__satRwBuilderHeaders || {}, this.__satRwBuilderUrl || ''); } catch (_) {}
      return originalSend.apply(this, arguments);
    };
  } catch (_) {}
})();
