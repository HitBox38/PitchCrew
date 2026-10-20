import type { ReactNode } from 'react';

export const SettingsIntro = ({
  title,
  description,
  id,
  actions,
}: {
  title: string;
  description: string;
  id?: string;
  actions?: ReactNode;
}) => (
  <header className="settings-intro">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 basis-64">
        <h2 id={id}>{title}</h2>
        <p className="quiet">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  </header>
);
