/**
 * Events module - fetching and parsing event data from idziemynamiasto.pl
 */
const EventsModule = (() => {
  const API_URL = 'https://idziemynamiasto.pl';
  const CORS_PROXIES = [
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];
  const CACHE_KEY = 'inm_events_cache';
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  function isValidUrl(str) {
    try {
      const u = new URL(str);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch { return false; }
  }

  function parseEvents(html) {
    const events = [];
    // Extract JSON-LD blocks using regex (DOMParser strips script contents)
    const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
          for (const listItem of data.itemListElement) {
            const item = listItem.item;
            if (!item || !item.name) continue;

            const eventType = normalizeType(item.eventType || '');
            const url = isValidUrl(item.url) ? item.url : null;

            events.push({
              id: `evt-${listItem.position || events.length}`,
              name: item.name,
              type: eventType,
              date: item.startDate || null,
              location: item.location?.name?.trim() || 'Lublin',
              url: url,
            });
          }
        }
      } catch (e) {
        console.warn('Failed to parse JSON-LD block:', e);
      }
    }

    return events;
  }

  function normalizeType(type) {
    const t = type.toLowerCase().trim();
    const known = ['film', 'wystawa', 'spektakl', 'teatr', 'koncert', 'dzieci'];
    if (known.includes(t)) return t === 'dzieci' ? 'inne' : t;
    return t || 'inne';
  }

  async function fetchWithProxy(url, proxyIndex = 0) {
    if (proxyIndex >= CORS_PROXIES.length) {
      throw new Error('All CORS proxies failed');
    }
    const proxyUrl = CORS_PROXIES[proxyIndex](url);
    try {
      const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } catch (e) {
      console.warn(`Proxy ${proxyIndex} failed:`, e.message);
      return fetchWithProxy(url, proxyIndex + 1);
    }
  }

  function getCached() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { events, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp > CACHE_TTL) return null;
      return events;
    } catch { return null; }
  }

  function setCache(events) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        events,
        timestamp: Date.now(),
      }));
    } catch { /* quota exceeded */ }
  }

  async function loadEvents(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = getCached();
      if (cached) return cached;
    }

    const html = await fetchWithProxy(API_URL);
    const events = parseEvents(html);

    if (events.length > 0) {
      setCache(events);
    }

    return events;
  }

  // Try to get offline data if fetch fails
  function getOfflineEvents() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return [];
      return JSON.parse(raw).events || [];
    } catch { return []; }
  }

  return { loadEvents, getOfflineEvents };
})();
