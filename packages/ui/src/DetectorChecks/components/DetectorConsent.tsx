import { useRef } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@pitchcrew/design-system/dialog';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { providerNames } from '../helpers.ts';
import type { Consent } from '../hooks/useDetectorChecks.ts';

/** The exact text and the named service, shown before anything leaves the device. */
export const DetectorConsent = ({
  consent,
  close,
  confirm,
  working,
}: {
  consent: Consent | null;
  close: () => void;
  confirm: (consent: Consent) => void;
  working: boolean;
}) => {
  const cancel = useRef<HTMLButtonElement>(null);
  if (!consent) return null;
  const name = providerNames[consent.provider];
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent
        initialFocus={cancel}
        className="modal detector-consent"
        showCloseButton={false}
      >
        <DialogTitle>
          Send the {consent.row.label.toLowerCase()} to {name}?
        </DialogTitle>
        <DialogDescription>
          Exactly this text leaves your device, once, to your own {name} account, and the provider
          bills you. Nothing from Profile, the job brief or chat is included. The result is
          advisory: it never blocks approval or export and never proves authorship.
        </DialogDescription>
        <SourceBlock
          label={`${consent.row.label} (${consent.row.text.length} characters)`}
          value={consent.row.text}
        />
        <div className="settings-form-actions">
          <Button ref={cancel} variant="ghost" className="ml-auto" onClick={close}>
            Keep it local
          </Button>
          <Button disabled={working} onClick={() => confirm(consent)}>
            Check with {name}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
