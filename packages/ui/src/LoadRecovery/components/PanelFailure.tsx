import { Dialog, DialogContent, DialogTitle } from '@pitchcrew/design-system/dialog';
import { LoadFailure, type LoadFailureProps } from './LoadFailure.tsx';

type PanelFailureProps = Pick<LoadFailureProps, 'error' | 'subject' | 'onRetry'> & {
  onClose: () => void;
};

/** A failed panel opens as a small clay dialog over the still-working workspace. */
export const PanelFailure = ({ error, subject, onRetry, onClose }: PanelFailureProps) => (
  <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
    <DialogContent className="modal load-failure-modal" showCloseButton={false}>
      <LoadFailure
        error={error}
        subject={subject}
        onRetry={onRetry}
        onClose={onClose}
        titleAs={(title) => <DialogTitle className="load-failure-title">{title}</DialogTitle>}
      />
    </DialogContent>
  </Dialog>
);
