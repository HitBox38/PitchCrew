import type { ReactNode } from 'react';

/** One findings group: a muted label (with a bead when it waits on the user or blocks), its items. */
export const Finding = ({
  label,
  tone,
  note,
  children,
}: {
  label: string;
  tone?: 'rose' | 'ochre';
  note?: string;
  children: ReactNode;
}) => (
  <div>
    <dt>
      {tone ? (
        <span className="clay-bead" data-size="sm" data-tone={tone} aria-hidden="true" />
      ) : null}
      {label}
    </dt>
    <dd>
      <ul>{children}</ul>
      {note ? <small>{note}</small> : null}
    </dd>
  </div>
);
