/**
 * Filters module - filtering events by type, date, search query
 */
const FiltersModule = (() => {
  let currentType = 'all';
  let currentDate = 'all';
  let currentQuery = '';

  function setType(type) { currentType = type; }
  function setDate(date) { currentDate = date; }
  function setQuery(query) { currentQuery = query.toLowerCase().trim(); }

  function getState() {
    return { type: currentType, date: currentDate, query: currentQuery };
  }

  function matchesType(event) {
    if (currentType === 'all') return true;
    return event.type === currentType;
  }

  function matchesDate(event) {
    if (currentDate === 'all') return true;
    if (!event.date) return currentDate === 'all';

    const eventDate = new Date(event.date);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

    switch (currentDate) {
      case 'today':
        return eventDay.getTime() === today.getTime();
      case 'tomorrow':
        return eventDay.getTime() === tomorrow.getTime();
      case 'week':
        return eventDay >= today && eventDay < weekEnd;
      default:
        return true;
    }
  }

  function matchesQuery(event) {
    if (!currentQuery) return true;
    const searchable = `${event.name} ${event.location} ${event.type}`.toLowerCase();
    return searchable.includes(currentQuery);
  }

  function apply(events) {
    return events.filter(e => matchesType(e) && matchesDate(e) && matchesQuery(e));
  }

  return { setType, setDate, setQuery, apply, getState };
})();
