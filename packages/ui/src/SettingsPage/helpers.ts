export type SettingsSection = 'general' | 'accounts' | 'runtimes' | 'data';

export function validateSettingsSearch(search: Record<string, unknown>): {
  section: SettingsSection;
} {
  const section = search.section;
  return {
    section:
      section === 'accounts' || section === 'runtimes' || section === 'data' ? section : 'general',
  };
}
