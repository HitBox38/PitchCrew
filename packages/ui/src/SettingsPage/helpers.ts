export type SettingsSection = 'general' | 'accounts' | 'sources' | 'runtimes' | 'data';

export function validateSettingsSearch(search: Record<string, unknown>): {
  section: SettingsSection;
} {
  const section = search.section;
  return {
    section:
      section === 'accounts' ||
      section === 'sources' ||
      section === 'runtimes' ||
      section === 'data'
        ? section
        : 'general',
  };
}
