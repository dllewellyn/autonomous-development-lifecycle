/**
 * Normalizes a given name string by trimming whitespace and converting to Title Case.
 * @param name The name string to normalize.
 * @returns The normalized name string.
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalizes a date string into 'YYYY-MM-DD' format.
 * Assumes input date string is parseable by Date constructor.
 * @param dateString The date string to normalize.
 * @returns The date string in 'YYYY-MM-DD' format, or an empty string if invalid.
 */
export function normalizeDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return ''; // Invalid date
  }
  return date.toISOString().split('T')[0];
}
