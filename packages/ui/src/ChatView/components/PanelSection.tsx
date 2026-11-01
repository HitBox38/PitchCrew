import type { ReactNode } from 'react';

/** Groups related panel fields in a recessed clay tray. */
export const PanelSection = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => <section className={`chat-panel-section ${className}`}>{children}</section>;
