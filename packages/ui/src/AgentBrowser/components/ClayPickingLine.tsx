import { Button } from '@pitchcrew/design-system/button';
import { browserCancelPickEvent } from '@/DesktopBrowserHost/presence.ts';

/**
 * The tray while the user picks an element: what to do, how to stop, and a Cancel that goes
 * through the pick's owner, so a cancelled pick can never start or open its review late.
 */
export const ClayPickingLine = () => (
  <p className="clay-tray-line" data-picking="">
    <span className="clay-bead" data-size="sm" data-tone="primary" aria-hidden="true" />
    <span className="truncate">Click an element on the page to attach it. Esc cancels.</span>
    <Button
      size="sm"
      variant="outline"
      className="browser-handoff"
      onClick={() => window.dispatchEvent(new Event(browserCancelPickEvent))}
    >
      Cancel
    </Button>
  </p>
);
