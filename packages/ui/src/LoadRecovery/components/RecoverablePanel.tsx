import type { ComponentType } from 'react';
import { PanelLoadBoundary } from './PanelLoadBoundary.tsx';

/** Wraps a lazily loaded sheet or dialog so a failed load offers Try again and Close. */
export const recoverablePanel = <P extends { onClose: () => void }>(
  Panel: ComponentType<P>,
  subject: string,
) => {
  const RecoverablePanel = (props: P) => (
    <PanelLoadBoundary subject={subject} onClose={props.onClose}>
      <Panel {...props} />
    </PanelLoadBoundary>
  );
  return RecoverablePanel;
};
