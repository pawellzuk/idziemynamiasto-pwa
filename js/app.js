/**
 * App module - main application logic, UI rendering, event handling
 */
(() => {
  let allEvents = [];
  let currentTab = 'events';

  // ===== DOM refs =====
  const $ = id => document.getElementById(id);
  const eventsGrid = $('events-grid');
  const favoritesGrid = $('favorites-grid');
  const eventsCount = $('events-count');
  const loading = $('loading');
  const error = $('error');
  const empty = $('empty');
  const emptyFavs = $('empty-favorites');
  const searchInput = $('search-input');
  const filtersBar = $('filters-bar');

  // ===== Init =====
  document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initTabs();
    initFilters();
    initInstall();
    registerSW();
    await loadAndRender();
  });

  // ===== Data loading =====
  async function loadAndRender(forceRefresh = false) {
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    empty.classList.add('hidden');
    eventsGrid.innerHTML = '';

    try {
      allEvents = await EventsModule.loadEvents(forceRefresh);
      loading.classList.add('hidden');
      renderEvents();
    } catch (e) {
      console.error('Failed to load events:', e);
      // Try offline
      allEvents = EventsModule.getOfflineEvents();
      loading.classList.add('hidden');
      if (allEvents.length > 0) {
        renderEvents();
      } else {
        error.classList.remove('hidden');
      }
    }
  }

  $('btn-retry').addEventListener('click', () => loadAndRender(true));

  // ===== Rendering =====
  function renderEvents() {
    const filtered = FiltersModule.apply(allEvents);
    eventsGrid.innerHTML = '';

    if (filtered.length === 0) {
      empty.classList.remove('hidden');
      eventsCount.textContent = '';
    } else {
      empty.classList.add('hidden');
      eventsCount.textContent = `${filtered.length} wydarzen`;
      const fragment = document.createDocumentFragment();
      for (const event of filtered) {
        fragment.appendChild(createEventCard(event));
      }
      eventsGrid.appendChild(fragment);
    }

    // Update map if visible
    if (currentTab === 'map') {
      MapModule.updateMarkers(filtered);
    }
  }

  function renderFavorites() {
    const favEvents = FavoritesModule.getFavoriteEvents(allEvents);
    favoritesGrid.innerHTML = '';

    if (favEvents.length === 0) {
      emptyFavs.classList.remove('hidden');
    } else {
      emptyFavs.classList.add('hidden');
      const fragment = document.createDocumentFragment();
      for (const event of favEvents) {
        fragment.appendChild(createEventCard(event));
      }
      favoritesGrid.appendChild(fragment);
    }
  }

  function createEventCard(event) {
    const card = document.createElement('article');
    card.className = 'event-card';
    const isFav = FavoritesModule.isFavorite(event.id);
    const badgeClass = `badge-${event.type}`;
    const dateStr = event.date ? formatDate(event.date) : '';
    const timeStr = event.date ? formatTime(event.date) : '';

    card.innerHTML = `
      <div class="event-card-body">
        <span class="event-type-badge ${badgeClass}">${escapeHtml(typeLabel(event.type))}</span>
        <h3 class="event-title">${escapeHtml(event.name)}</h3>
        <div class="event-meta">
          ${dateStr ? `
          <div class="event-meta-row">
            <svg class="event-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            <span>${dateStr}${timeStr ? ', ' + timeStr : ''}</span>
          </div>` : ''}
          <div class="event-meta-row">
            <svg class="event-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span>${escapeHtml(event.location)}</span>
          </div>
        </div>
      </div>
      <div class="event-card-footer">
        ${event.url
          ? `<a href="${escapeHtml(event.url)}" class="event-link" target="_blank" rel="noopener">Szczegoly</a>`
          : `<span></span>`}
        <button class="fav-btn ${isFav ? 'is-fav' : ''}" data-id="${event.id}" aria-label="${isFav ? 'Usun z ulubionych' : 'Dodaj do ulubionych'}">
          ${isFav ? '\u2764\uFE0F' : '\u2661'}
        </button>
      </div>
    `;

    // Fav button handler
    card.querySelector('.fav-btn').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const added = FavoritesModule.toggle(event.id);
      btn.classList.toggle('is-fav', added);
      btn.innerHTML = added ? '\u2764\uFE0F' : '\u2661';
      btn.setAttribute('aria-label', added ? 'Usun z ulubionych' : 'Dodaj do ulubionych');

      if (currentTab === 'favorites') {
        renderFavorites();
      }
    });

    return card;
  }

  // ===== Tabs =====
  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      });
    });
  }

  function switchTab(tab) {
    currentTab = tab;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    document.getElementById(`tab-${tab}`).classList.add('active');

    // Show/hide filters
    filtersBar.classList.toggle('hidden', tab === 'map');

    // Tab-specific actions
    if (tab === 'favorites') {
      renderFavorites();
    } else if (tab === 'map') {
      MapModule.init();
      MapModule.invalidateSize();
      const filtered = FiltersModule.apply(allEvents);
      MapModule.updateMarkers(filtered);
    }
  }

  // ===== Filters =====
  function initFilters() {
    // Type chips
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        FiltersModule.setType(chip.dataset.type);
        renderEvents();
      });
    });

    // Date chips
    document.querySelectorAll('.date-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        FiltersModule.setDate(chip.dataset.date);
        renderEvents();
      });
    });

    // Search
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        FiltersModule.setQuery(searchInput.value);
        renderEvents();
      }, 250);
    });
  }

  // ===== Theme =====
  function initTheme() {
    const saved = localStorage.getItem('inm_theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    $('btn-theme').addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('inm_theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('inm_theme', 'dark');
      }
    });
  }

  // ===== PWA Install =====
  let deferredPrompt = null;

  function initInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      $('btn-install').classList.remove('hidden');
    });

    $('btn-install').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        $('btn-install').classList.add('hidden');
      }
      deferredPrompt = null;
    });
  }

  // ===== Service Worker =====
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.warn('SW registration failed:', err);
      });
    }
  }

  // ===== Helpers =====
  function formatDate(dateStr) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
    } catch { return ''; }
  }

  function formatTime(dateStr) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  function typeLabel(type) {
    const labels = {
      film: 'Film',
      wystawa: 'Wystawa',
      spektakl: 'Spektakl',
      teatr: 'Teatr',
      koncert: 'Koncert',
      inne: 'Inne',
    };
    return labels[type] || type;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
