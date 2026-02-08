/**
 * Favorites module - managing favorite events in localStorage
 */
const FavoritesModule = (() => {
  const STORAGE_KEY = 'inm_favorites';

  function getAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch { return []; }
  }

  function save(ids) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }

  function isFavorite(eventId) {
    return getAll().includes(eventId);
  }

  function toggle(eventId) {
    const favs = getAll();
    const idx = favs.indexOf(eventId);
    if (idx === -1) {
      favs.push(eventId);
    } else {
      favs.splice(idx, 1);
    }
    save(favs);
    return idx === -1; // returns true if added
  }

  function getFavoriteEvents(allEvents) {
    const favIds = getAll();
    return allEvents.filter(e => favIds.includes(e.id));
  }

  return { isFavorite, toggle, getFavoriteEvents, getAll };
})();
