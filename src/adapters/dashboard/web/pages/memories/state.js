/* What the memories page is filtered to, kept apart from the markup so a live refresh redraws and leaves every choice as it was.
   One filter listener: the list. */
/** `hold`: firm / settling / fading, set from the "How firmly it's held" bar. */
export const filters = { state: "live", kind: null, core: false, journal: false, hold: null, sort: "newest", offset: 0 };

const listeners = [];
export function onFilter(fn) { listeners.push(fn); }

/** Change some filters; any change other than the page offset starts at page one. */
export function setFilter(patch) {
  const pageOnly = Object.keys(patch).length === 1 && "offset" in patch;
  Object.assign(filters, patch);
  if (!pageOnly) filters.offset = 0;
  for (const fn of listeners) fn(filters);
}

/** A kind chip (or a part of the hold bar) is a toggle: click it again to
 *  show everything. Core and journal chips are on/off. */
export function toggle(key, value) {
  if (key === "core" || key === "journal") setFilter({ [key]: !filters[key] });
  else setFilter({ [key]: filters[key] === value ? null : value });
}

/** Tell the page the store changed on purpose (a note, a removal). */
export function changed() { window.dispatchEvent(new CustomEvent("counterparts:changed")); }
