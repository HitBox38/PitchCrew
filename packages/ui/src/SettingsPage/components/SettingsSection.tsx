import type { ReactNode } from 'react';

/** One settings section: a 16px heading with an optional count and trailing actions. */
export const SettingsSection = ({
  id,
  title,
  count,
  description,
  actions,
  autosave = false,
  className,
  scope,
  children,
}: {
  id: string;
  title: string;
  count?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  autosave?: boolean;
  className?: string;
  scope?: string;
  children?: ReactNode;
}) => (
  <section
    className={`ui-section settings-section ${className ?? ''}`}
    aria-labelledby={id}
    data-autosave={autosave || undefined}
  >
    <div className="settings-section-head">
      <h3 id={id} className="ui-section-heading" tabIndex={-1}>
        {title}
        {count !== undefined ? <span className="ui-count">{count}</span> : null}
        {autosave ? <span className="settings-saved" aria-hidden="true" /> : null}
      </h3>
      {scope ? <span className="settings-section-scope">{scope}</span> : null}
      {actions ? <div className="settings-section-actions">{actions}</div> : null}
    </div>
    {description ? <p className="settings-section-note">{description}</p> : null}
    {children}
  </section>
);
