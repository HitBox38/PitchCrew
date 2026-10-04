export type SettingsSection = 'general' | 'accounts' | 'runtimes' | 'rules' | 'data';

export function validateSettingsSearch(search: Record<string, unknown>): {
  section: SettingsSection;
} {
  const section = search.section;
  return {
    section:
      section === 'accounts' || section === 'runtimes' || section === 'rules' || section === 'data'
        ? section
        : 'general',
  };
}
