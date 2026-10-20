export type SettingsSection =
  | 'general'
  | 'accounts'
  | 'sources'
  | 'runtimes'
  | 'rules'
  | 'writing'
  | 'data';

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
      section === 'writing' ||
      section === 'data'
        ? section
        : 'general',
  };
}
