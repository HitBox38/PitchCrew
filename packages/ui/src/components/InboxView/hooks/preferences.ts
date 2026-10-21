export const readInboxPreference = <T>(key: string, fallback: T): T => {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(`pitchcrew.inbox.${key}`) ?? 'null');
    if (value === null) return fallback;
    if (key === 'tab' && !['pending', 'history'].includes(String(value))) return fallback;
    if (key === 'filter' && !['all', 'packet', 'browser'].includes(String(value))) return fallback;
    if (fallback === null) return (typeof value === 'string' ? value : fallback) as T;
    if (typeof value !== typeof fallback || (typeof value === 'number' && !Number.isFinite(value)))
      return fallback;
    return value as T;
  } catch {
    return fallback;
  }
};
export const saveInboxPreference = (key: string, value: unknown) => {
  try {
    sessionStorage.setItem(`pitchcrew.inbox.${key}`, JSON.stringify(value));
  } catch {
    /* Optional. */
  }
};
export const readInboxReadIds = (): string[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('pitchcrew-inbox-read-v1') ?? '[]');
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string').slice(-10000)
      : [];
  } catch {
    return [];
  }
};
export const saveInboxReadIds = (ids: string[]) => {
  try {
    localStorage.setItem('pitchcrew-inbox-read-v1', JSON.stringify(ids.slice(-10000)));
  } catch {
    /* Optional. */
  }
};
