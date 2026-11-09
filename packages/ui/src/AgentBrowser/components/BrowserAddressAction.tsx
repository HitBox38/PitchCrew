import { ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';

/** Go while typing an address; otherwise open the page in the system browser, if offered. */
export const BrowserAddressAction = ({
  editing,
  usable,
  pending,
  onOpenExternal,
}: {
  editing: boolean;
  usable: boolean;
  pending: boolean;
  onOpenExternal?: () => void;
}) =>
  usable && editing ? (
    <Button
      type="submit"
      size="icon-sm"
      variant="ghost"
      aria-label="Go to address"
      title="Go to address (Enter)"
      disabled={pending}
      // Keep the field focused so the button is still here when the click lands.
      onPointerDown={(event) => event.preventDefault()}
    >
      <ArrowRight size={15} />
    </Button>
  ) : onOpenExternal && !editing ? (
    <Button
      size="icon-sm"
      variant="ghost"
      className="browser-address-external"
      aria-label="Open page in system browser"
      title="Open in system browser"
      disabled={!usable}
      onClick={onOpenExternal}
    >
      <ExternalLink size={14} />
    </Button>
  ) : null;
