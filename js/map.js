/**
 * Map module - Leaflet/OpenStreetMap integration
 */
const MapModule = (() => {
  let map = null;
  let markers = [];
  let initialized = false;

  // Known Lublin venues with coordinates
  const VENUE_COORDS = {
    'centrum spotkania kultur': [51.2465, 22.5588],
    'csk': [51.2465, 22.5588],
    'muzeum narodowe': [51.2488, 22.5458],
    'galeria labirynt': [51.2503, 22.5545],
    'kino bajka': [51.2478, 22.5602],
    'multikino': [51.2372, 22.5498],
    'cinema city': [51.2195, 22.5180],
    'cinema city felicity': [51.2195, 22.5180],
    'cinema city plaza': [51.2450, 22.5730],
    'teatr stary': [51.2485, 22.5618],
    'teatr im. juliusza osterwy': [51.2490, 22.5550],
    'teatr osterwy': [51.2490, 22.5550],
    'ck lublin': [51.2468, 22.5570],
    'filharmonia lubelska': [51.2478, 22.5510],
    'brama grodzka': [51.2498, 22.5665],
    'zamek lubelski': [51.2503, 22.5698],
    'trybunał koronny': [51.2488, 22.5658],
    'chatka żaka': [51.2465, 22.5445],
    'dom kultury lsm': [51.2560, 22.5430],
    'centrum kultury': [51.2468, 22.5570],
    'ośrodek brama grodzka': [51.2498, 22.5665],
  };

  // Default Lublin center
  const LUBLIN_CENTER = [51.2465, 22.5684];

  function findCoords(locationName) {
    const loc = locationName.toLowerCase();
    for (const [key, coords] of Object.entries(VENUE_COORDS)) {
      if (loc.includes(key)) return coords;
    }
    return null;
  }

  function init() {
    if (initialized) return;
    const container = document.getElementById('map-container');
    if (!container) return;

    map = L.map('map-container').setView(LUBLIN_CENTER, 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    initialized = true;
  }

  function updateMarkers(events) {
    if (!map) return;

    // Clear existing
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    // Group events by venue
    const venues = {};
    for (const event of events) {
      const coords = findCoords(event.location);
      if (!coords) continue;
      const key = coords.join(',');
      if (!venues[key]) {
        venues[key] = { coords, name: event.location, events: [] };
      }
      venues[key].events.push(event);
    }

    // Create markers
    for (const venue of Object.values(venues)) {
      const icon = L.divIcon({
        html: `<div style="
          background: #E91E63;
          color: white;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          border: 2px solid white;
        ">${venue.events.length}</div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const popupContent = `
        <div style="max-height:200px;overflow-y:auto;">
          <strong>${escapeHtml(venue.name)}</strong>
          <hr style="margin:6px 0;border:none;border-top:1px solid #eee;">
          ${venue.events.slice(0, 10).map(e => `
            <div style="margin:4px 0;font-size:13px;">
              ${e.url
                ? `<a href="${escapeHtml(e.url)}" target="_blank" rel="noopener">${escapeHtml(e.name)}</a>`
                : escapeHtml(e.name)}
              ${e.date ? `<br><small style="color:#888;">${formatTime(e.date)}</small>` : ''}
            </div>
          `).join('')}
          ${venue.events.length > 10 ? `<div style="font-size:12px;color:#888;margin-top:6px;">...i ${venue.events.length - 10} wiecej</div>` : ''}
        </div>
      `;

      const marker = L.marker(venue.coords, { icon })
        .addTo(map)
        .bindPopup(popupContent, { maxWidth: 260 });

      markers.push(marker);
    }
  }

  function invalidateSize() {
    if (map) {
      setTimeout(() => map.invalidateSize(), 100);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTime(dateStr) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('pl-PL', {
        day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
  }

  return { init, updateMarkers, invalidateSize };
})();
