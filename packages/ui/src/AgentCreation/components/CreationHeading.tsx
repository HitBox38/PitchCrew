import { X } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { SheetTitle } from '@/components/ui/sheet/components/SheetTitle.tsx';
import { SheetDescription } from '@/components/ui/sheet/components/SheetDescription.tsx';
import { creationSteps } from '../constants.ts';
import type { CreationController } from '../types.ts';

export function CreationHeading({
  step,
  close,
  created,
  saving,
  working,
  goTo,
}: Pick<CreationController, 'step' | 'close' | 'created' | 'saving' | 'working' | 'goTo'>) {
  return (
    <>
      <header className="role-settings-heading">
        <div>
          <SheetTitle>{created ? 'Agent created' : 'Create agent'}</SheetTitle>
          <SheetDescription>
            {created
              ? 'Your new crew member is ready to configure or chat.'
              : 'Define a role for any kind of work.'}
          </SheetDescription>
        </div>
        <Button
          variant="ghost"
          className="icon-button"
          disabled={saving}
          onClick={close}
          aria-label="Close agent creation"
        >
          <X size={20} />
        </Button>
      </header>
      {!created ? (
        <nav className="creation-progress" aria-label="Agent setup steps">
          <ol>
            {creationSteps.map((label, index) => (
              <li key={label}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={saving || working || index > step}
                  aria-current={index === step ? 'step' : undefined}
                  onClick={() => goTo(index)}
                >
                  <span className="creation-step-number">{index + 1}</span>
                  <span>{label}</span>
                </Button>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
    </>
  );
}
