import { Button } from '@/components/ui/button/components/Button.tsx';
import { Dialog } from '@/components/ui/dialog/components/Dialog.tsx';
import { DialogContent } from '@/components/ui/dialog/components/DialogContent.tsx';
import { DialogTitle } from '@/components/ui/dialog/components/DialogTitle.tsx';
import { DialogDescription } from '@/components/ui/dialog/components/DialogDescription.tsx';
import { CrewIntroduction } from './CrewIntroduction.tsx';
import { ApprovalIntroduction } from './ApprovalIntroduction.tsx';
import type { OnboardingActions } from '../types.ts';
import { useRef } from 'react';

/** Two screens in a centred 600px clay sheet; dismissing defers setup as before. */
export const WelcomeDialog = ({
  step,
  working,
  error,
  save,
}: OnboardingActions & { step: 0 | 1 }) => {
  const next = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void save('dismissed');
      }}
    >
      <DialogContent className="onboarding-dialog" showCloseButton={false} initialFocus={next}>
        <header className="onboarding-header">
          <span className="onboarding-step">{step + 1} of 2</span>
          <DialogTitle className="onboarding-title">
            {step === 0 ? 'Your job search has a crew.' : 'You make the final call.'}
          </DialogTitle>
          <DialogDescription className="onboarding-lede">
            {step === 0
              ? 'Three agents turn a job post into an application you can stand behind.'
              : 'Draft together, review carefully, approve when you’re ready.'}
          </DialogDescription>
        </header>
        {step === 0 ? <CrewIntroduction /> : <ApprovalIntroduction />}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <footer className="onboarding-footer">
          <Button variant="ghost" disabled={working} onClick={() => void save('dismissed')}>
            Set up later
          </Button>
          {step === 1 ? (
            <Button variant="outline" disabled={working} onClick={() => void save('welcome', 0)}>
              Back
            </Button>
          ) : null}
          <Button
            ref={next}
            disabled={working}
            onClick={() => void save(step === 0 ? 'welcome' : 'setup', step === 0 ? 1 : 0)}
          >
            {working ? 'Saving…' : step === 0 ? 'Continue' : 'Start setup'}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
};
