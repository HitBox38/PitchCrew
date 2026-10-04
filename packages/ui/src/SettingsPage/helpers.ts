export type SettingsSection = 'general' | 'accounts' | 'sources' | 'runtimes' | 'rules' | 'data';

export function validateSettingsSearch(search: Record<string, unknown>): {
  section: SettingsSection;
} {
  const section = search.section;
  return {
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
