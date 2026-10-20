import type { ReactNode } from 'react';

export const QueueSectionHeading = ({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) => (
  <div className="queue-section-heading">
    <h2>
      {title}
      <span>{count}</span>
    </h2>
    <p>{children}</p>
  </div>
);
