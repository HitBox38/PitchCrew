import type { ReactNode } from 'react';

/** A panel form's decision buttons, pinned to the bottom of the panel with the primary action at the end. */
export const PanelActions = ({ children }: { children: ReactNode }) => (
  <div className="chat-panel-actions">{children}</div>
);
