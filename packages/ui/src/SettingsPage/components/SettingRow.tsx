import type { ReactNode } from 'react';

/** A preference row: title and description on the left, its control on the right. */
export const SettingRow = ({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) => (
  <label className="settings-row" htmlFor={id}>
    <span>
      <strong id={`${id}-label`}>{title}</strong>
      {description ? (
        <span id={`${id}-description`} className="quiet block">
          {description}
        </span>
      ) : null}
    </span>
    {children}
  </label>
);
