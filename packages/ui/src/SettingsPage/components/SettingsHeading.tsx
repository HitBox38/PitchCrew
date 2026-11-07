import { settingsSections } from '../constants.ts';

export const SettingsHeading = ({ section }: { section: string }) => {
  const entry = settingsSections.find((item) => item.id === section)!;
  return (
    <header className="settings-heading">
      <h2 id={`settings-${section}-heading`}>{entry.label}</h2>
      <p>{entry.scope}</p>
    </header>
  );
};
