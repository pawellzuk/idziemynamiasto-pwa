/**
 * Events module - fetching event data
 * Primary: static JSON file (data/events.json)
 * Fallback: CORS proxy to idziemynamiasto.pl
 * Offline: localStorage cache
 */
const EventsModule = (() => {
  const STATIC_DATA_URL = 'data/events.json';
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

  function normalizeType(type) {
    const t = (type || '').toLowerCase().trim();
    const known = ['film', 'wystawa', 'spektakl', 'teatr', 'koncert', 'dzieci'];
    if (known.includes(t)) return t === 'dzieci' ? 'inne' : t;
    return t || 'inne';
  }

  function normalizeEvent(e) {
    return {
      id: e.id,
      name: e.name,
      type: normalizeType(e.type),
      date: e.date || null,
      location: (e.location || 'Lublin').trim(),
      url: (e.url && isValidUrl(e.url)) ? e.url : null,
    };
  }

  function parseEventsFromHtml(html) {
    const events = [];
    const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
          for (const listItem of data.itemListElement) {
            const item = listItem.item;
            if (!item || !item.name) continue;
            events.push(normalizeEvent({
              id: `evt-${listItem.position || events.length}`,
              name: item.name,
              type: item.eventType,
              date: item.startDate,
              location: item.location?.name,
              url: item.url,
            }));
          }
        }
      } catch (e) {
        console.warn('Failed to parse JSON-LD block:', e);
      }
    }
    return events;
  }

  async function fetchStaticData() {
    const resp = await fetch(STATIC_DATA_URL, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data.map(normalizeEvent);
  }

  async function fetchWithProxy(url, proxyIndex = 0) {
    if (proxyIndex >= CORS_PROXIES.length) {
      throw new Error('All CORS proxies failed');
    }
    const proxyUrl = CORS_PROXIES[proxyIndex](url);
    try {
      const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      const events = parseEventsFromHtml(html);
      if (events.length === 0) throw new Error('No events parsed from proxy');
      return events;
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

    // Try static JSON first (reliable), then CORS proxy (fresh data)
    let events = [];
    try {
      events = await fetchStaticData();
    } catch (e) {
      console.warn('Static data failed:', e.message);
    }

    // Try proxy for fresher data (non-blocking if static worked)
    if (events.length === 0) {
      try {
        events = await fetchWithProxy(API_URL);
      } catch (e) {
        console.warn('Proxy fetch failed:', e.message);
      }
    }

    if (events.length > 0) {
      setCache(events);
    }

    return events;
  }

  function getOfflineEvents() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return [];
      return JSON.parse(raw).events || [];
    } catch { return []; }
  }

  return { loadEvents, getOfflineEvents };
})();
