/**
 * Formats a date string into a localized format using the provided timezone.
 * @param {string|Date} date - The date to format.
 * @param {string} timezone - The timezone identifier (e.g., 'Europe/London' or 'auto').
 * @param {object} options - Intl.DateTimeFormat options.
 * @param {string} locale - The locale to use for formatting.
 * @returns {string}
 */
export function formatInTimezone(date, timezone, options = {}, locale = 'en') {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const finalOptions = {
    ...options,
    timeZone: !timezone || timezone === 'auto' ? undefined : timezone,
  };

  // Ensure locale is a string and fallback to 'en'
  const targetLocale = (typeof locale === 'string' && locale) ? locale : 'en';

  try {
    return new Intl.DateTimeFormat(targetLocale, finalOptions).format(d);
  } catch (err) {
    console.warn(`Invalid timezone or locale: ${timezone}, ${targetLocale}`, err);
    try {
      // Try with just the locale if timezone is the issue
      return new Intl.DateTimeFormat(targetLocale, options).format(d);
    } catch (innerErr) {
      return d.toLocaleString(targetLocale);
    }
  }
}

/**
 * Gets a relative time string while respecting the timezone for the baseline.
 */
export function getRelativeTime(dateStr, t, timezone, locale = 'en') {
  const now = new Date();
  const target = new Date(dateStr);
  const diff = now.getTime() - target.getTime();
  
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('library.justNow') || 'Just now';
  if (mins < 60) return t('library.minutesAgo', { count: mins }) || `${mins}m ago`;
  
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('library.hoursAgo', { count: hours }) || `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 30) return t('library.daysAgo', { count: days }) || `${days}d ago`;

  return formatInTimezone(dateStr, timezone, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }, locale);
}
