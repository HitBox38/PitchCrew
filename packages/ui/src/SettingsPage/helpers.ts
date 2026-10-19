export type SettingsSection = 'general' | 'accounts' | 'sources' | 'runtimes' | 'rules' | 'data';

export function validateSettingsSearch(search: Record<string, unknown>): {
  section: SettingsSection;
  runtime?: string;
} {
  const section = search.section;
  return {
    ...(typeof search.runtime === 'string' && search.runtime.length < 100
      ? { runtime: search.runtime }
      : {}),
    section:
      section === 'accounts' ||
      section === 'sources' ||
      section === 'runtimes' ||
      section === 'rules' ||
      section === 'data'
        ? section
        : 'general',
  };
}
