/** One readable local date/time format for settings status and diagnostic details. */
export const settingsTime = (value: string): string =>
  new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
