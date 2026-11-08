import { useEffect, useRef, useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { reloadBlocked, reloadWarning } from '../helpers.ts';

/**
 * Reloading is the user's explicit choice, after saying what it discards. It never runs on its
 * own and never loops: if an unsaved-changes guard keeps the window open, the note says so.
 */
export const ReloadAction = ({ reload, primary }: { reload: () => void; primary: boolean }) => {
  const [confirming, setConfirming] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!confirming)
    return (
      <Button variant={primary ? 'default' : 'outline'} onClick={() => setConfirming(true)}>
        Reload Pitchcrew…
      </Button>
    );
  return (
    <div className="ui-tray load-failure-confirm">
      <p>{blocked ? reloadBlocked : `Reload Pitchcrew? ${reloadWarning}`}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          onClick={() => {
            setBlocked(false);
            reload();
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setBlocked(true), 1500);
          }}
        >
          Reload
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          Keep this window
        </Button>
      </div>
    </div>
  );
};
