import { Button } from '@pitchcrew/design-system/button';

/** The tray while the user picks an element: what to do, how to stop, and a Cancel. */
export const ClayPickingLine = ({ picking }: { picking: string }) => (
  <p className="clay-tray-line" data-picking="">
    <span className="clay-bead" data-size="sm" data-tone="primary" aria-hidden="true" />
    <span className="truncate">Click an element on the page to attach it. Esc cancels.</span>
    <Button
      size="sm"
      variant="outline"
      className="browser-handoff"
      onClick={() => void window.pitchcrewBrowser?.cancelPick?.(picking).catch(() => {})}
    >
      Cancel
    </Button>
  </p>
);
