export const SettingsIntro = ({ title, description }: { title: string; description: string }) => (
  <header className="settings-intro">
    <h2>{title}</h2>
    <p className="quiet">{description}</p>
  </header>
);
