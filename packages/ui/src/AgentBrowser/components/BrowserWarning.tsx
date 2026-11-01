import { useState } from 'react';
import { Hand, ShieldAlert } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { BrowserControl } from '../types.ts';

/**
 * The browser's only warning: preparation hit a website write request and switched to asking.
 * It names that as a stopped automatic step. The server already keeps the run going
 * with every further step supervised, so continuing only hides this note; I'll fill it takes the
 * existing private control.
 */
export const BrowserWarning = ({
  warning,
  control,
}: {
  warning?: string;
  control?: BrowserControl;
}) => {
  const [dismissed, setDismissed] = useState(false);
  // A cleared warning (new task, manual input) re-arms the note for the next one.
  if (!warning && dismissed) setDismissed(false);
  if (!warning) return null;
  if (dismissed) return null;
  return (
    <output className="clay-browser-notice" aria-label="Automatic preparation">
      <span className="clay-browser-chip" data-tone="ochre">
        <ShieldAlert size={13} aria-hidden="true" />
        Stopped automatic filling
      </span>
      <p>{warning}</p>
      <div className="clay-browser-notice-actions">
        {control && !control.leaseId ? (
          <Button size="sm" disabled={control.working} onClick={() => void control.take()}>
            <Hand size={14} aria-hidden="true" />
            I’ll fill it
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          title="Your agent keeps going and asks you before each remaining step."
          onClick={() => setDismissed(true)}
        >
          Continue, ask each step
        </Button>
      </div>
    </output>
  );
};
