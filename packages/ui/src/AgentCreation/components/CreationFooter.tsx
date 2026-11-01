import { Button } from '@/components/ui/button/components/Button.tsx';
import { creationSteps } from '../constants.ts';
import type { CreationController } from '../types.ts';

export const CreationFooter = ({
  step,
  error,
  saving,
  working,
  goTo,
  close,
}: Pick<CreationController, 'step' | 'error' | 'saving' | 'working' | 'goTo' | 'close'>) => {
  return (
    <footer className="ui-footer-bar agent-panel-footer">
      {error ? (
        <p className="form-error agent-panel-error" role="alert">
          {error}
        </p>
      ) : null}
      <span className="ui-footer-note">
        {step === 5 ? 'Saves the agent, skills and routine together.' : ''}
      </span>
      <Button
        className="button small"
        disabled={saving}
        onClick={step ? () => goTo(step - 1) : close}
      >
        {step ? 'Back' : 'Cancel'}
      </Button>
      <Button type="submit" className="button small primary" disabled={working || saving}>
        {saving
          ? 'Creating agent…'
          : step === 5
            ? 'Create agent'
            : `Continue to ${creationSteps[step + 1].toLowerCase()}`}
      </Button>
    </footer>
  );
};
