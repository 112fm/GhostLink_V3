(function registerKeyAppChoice(globalScope) {
  function cleanLink(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function normalizeKeyLinks(source) {
    const value = source && typeof source === 'object' ? source : {};
    return {
      url: cleanLink(value.url),
      url_incy: cleanLink(value.url_incy),
    };
  }

  function resolveKeyUrl(links, app) {
    const normalized = normalizeKeyLinks(links);
    if (app === 'karing') return normalized.url;
    if (app === 'incy') return normalized.url_incy;
    return '';
  }

  function resolveDefaultKeyApp({ preferredApp, platform, links } = {}) {
    const normalized = normalizeKeyLinks(links);
    const preferred = preferredApp === 'karing' || preferredApp === 'incy'
      ? preferredApp
      : null;

    if (preferred && resolveKeyUrl(normalized, preferred)) return preferred;

    const platformDefault = ['windows', 'linux', 'tv'].includes(platform)
      ? 'karing'
      : 'incy';
    if (resolveKeyUrl(normalized, platformDefault)) return platformDefault;

    const fallback = platformDefault === 'incy' ? 'karing' : 'incy';
    return resolveKeyUrl(normalized, fallback) ? fallback : null;
  }

  const exported = {
    normalizeKeyLinks,
    resolveDefaultKeyApp,
    resolveKeyUrl,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (globalScope) {
    globalScope.GhostLinkV3 = globalScope.GhostLinkV3 || {};
    Object.assign(globalScope.GhostLinkV3, exported);
  }
})(typeof window !== 'undefined' ? window : globalThis);
