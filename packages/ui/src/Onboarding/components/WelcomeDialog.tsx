import { Button } from '@/components/ui/button/components/Button.tsx';
import { Dialog } from '@/components/ui/dialog/components/Dialog.tsx';
import { DialogContent } from '@/components/ui/dialog/components/DialogContent.tsx';
import { DialogTitle } from '@/components/ui/dialog/components/DialogTitle.tsx';
import { DialogDescription } from '@/components/ui/dialog/components/DialogDescription.tsx';
import { CrewIntroduction } from './CrewIntroduction.tsx';
import { ApprovalIntroduction } from './ApprovalIntroduction.tsx';
import type { OnboardingActions } from '../types.ts';

export function WelcomeDialog({ step, working, error, save }: OnboardingActions & { step: 0 | 1 }) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void save('dismissed');
      }}
    >
      <DialogContent className="modal onboarding-dialog" showCloseButton={false}>
        <header className="mb-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <span className="onboarding-brand font-serif text-xl">Pitchcrew</span>
            <span className="text-sm text-muted-foreground">{step + 1} of 2</span>
          </div>
          <DialogTitle className="onboarding-title">
            {step === 0 ? 'Your job search has a crew.' : 'You make the final call.'}
          </DialogTitle>
          <DialogDescription className="mt-3 text-base leading-relaxed text-muted-foreground">
            {step === 0
              ? 'Three agents help turn a job post into an application you can stand behind.'
              : 'Draft together. Review carefully. Approve when you’re ready.'}
          </DialogDescription>
        </header>
        {step === 0 ? <CrewIntroduction /> : <ApprovalIntroduction />}
        {error ? (
          <p className="form-error mt-4" role="alert">
            {error}
          </p>
        ) : null}
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <Button
            className="button ghost"
            disabled={working}
            onClick={() => void save('dismissed')}
          >
            Set up later
          </Button>
          <div className="flex gap-2">
            {step === 1 ? (
              <Button className="button" disabled={working} onClick={() => void save('welcome', 0)}>
                Back
              </Button>
            ) : null}
            <Button
              className="button primary"
              disabled={working}
              onClick={() => void save(step === 0 ? 'welcome' : 'setup', step === 0 ? 1 : 0)}
            >
              {working ? 'Saving…' : step === 0 ? 'Meet your workspace' : 'Start setup'}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
