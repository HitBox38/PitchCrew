export const readInboxPreference = <T>(key: string, fallback: T): T => {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(`pitchcrew.inbox.${key}`) ?? 'null');
    if (value === null) return fallback;
    if (key === 'filter' && !['all', 'packet', 'browser'].includes(String(value))) return fallback;
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
