import type { ReactNode } from 'react';

/** One queue section: heading with a plain count, then its cards or a single recessed line. */
export const QueueSection = ({
  label,
  title,
  count,
  empty,
  children,
}: {
  label: string;
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) => (
  <section className="ui-section queue-section" aria-label={label}>
    <h2 className="ui-section-heading">
      {title}
      <span className="ui-count">{count}</span>
    </h2>
    {count ? null : <p className="ui-empty">{empty}</p>}
    {children}
  </section>
);
