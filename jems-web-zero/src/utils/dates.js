const _ET = 'America/New_York';

/**
 * Converts a UTC ISO 8601 string (as returned by the API) to a "YYYY-MM-DD HH:MM"
 * string in Eastern Time, which is the format the DateTimePicker emits and expects.
 *
 * If the value is already in "YYYY-MM-DD HH:MM" form (e.g. still in local state
 * after user interaction), it is returned unchanged.
 */
export function utcIsoToEtDisplay(isoStr) {
  if (!isoStr) return '';
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(isoStr)) return isoStr;

  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: _ET,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day} ${hour}:${p.minute}`;
}
