import { Button } from '@/components/ui/button/components/Button.tsx';
import { creationSteps } from '../constants.ts';
import type { CreationController } from '../types.ts';

export function CreationFooter({
  step,
  error,
  saving,
  working,
  goTo,
  close,
}: Pick<CreationController, 'step' | 'error' | 'saving' | 'working' | 'goTo' | 'close'>) {
  return (
    <footer className="role-settings-footer">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <Button className="button" disabled={saving} onClick={step ? () => goTo(step - 1) : close}>
          {step ? 'Back' : 'Cancel'}
        </Button>
        <Button type="submit" className="button primary" disabled={working || saving}>
          {saving
            ? 'Creating agent…'
            : step === 5
              ? 'Create agent'
              : `Continue to ${creationSteps[step + 1].toLowerCase()}`}
        </Button>
      </div>
    </footer>
  );
}
