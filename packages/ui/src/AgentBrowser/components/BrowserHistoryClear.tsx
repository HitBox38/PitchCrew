import { useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';

/** A quiet destructive row that asks once before clearing both history lists. */
export const BrowserHistoryClear = ({ clear }: { clear: () => void }) => {
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <fieldset className="browser-history-clear" aria-label="Clear browser history">
      <span>Clear visited and closed pages?</span>
      <Button
        size="sm"
        variant="ghost"
        className="browser-history-clear-confirm"
        onClick={() => {
          clear();
          setConfirming(false);
        }}
      >
        Clear
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </fieldset>
  ) : (
    <Button
      size="sm"
      variant="ghost"
      className="browser-history-clear-start"
      onClick={() => setConfirming(true)}
    >
      Clear browser history…
    </Button>
  );
};
