import { X } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { DialogDescription, DialogTitle } from '@pitchcrew/design-system/dialog';
import type { CreationController } from '../types.ts';
import { CreationSteps } from './CreationSteps.tsx';

export const CreationHeading = (
  props: Pick<CreationController, 'step' | 'close' | 'created' | 'saving' | 'working' | 'goTo'>,
) => {
  const { close, created, saving } = props;
  return (
    <header className="agent-wizard-heading">
      <div className="agent-wizard-titles">
        <DialogTitle>{created ? `${created.name} joined your crew` : 'New agent'}</DialogTitle>
        <DialogDescription className="sr-only">
          {created
            ? 'Your new crew member is ready to configure or chat.'
            : 'Define a role for any kind of work.'}
        </DialogDescription>
      </div>
      {!created ? <CreationSteps {...props} /> : null}
      <Button
        variant="ghost"
        className="icon-button agent-panel-close"
        disabled={saving}
        onClick={close}
        aria-label="Close agent creation"
      >
        <X size={18} />
      </Button>
    </header>
  );
};
