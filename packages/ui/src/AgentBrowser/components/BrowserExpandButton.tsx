import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { Kbd } from '@pitchcrew/design-system/kbd';

/** Expands the browser over the window or returns to the split view ("Back to chat"), which
 * Escape also does. */
export const BrowserExpandButton = ({
  expanded,
  toggle,
}: {
  expanded: boolean;
  toggle: () => void;
}) => {
  const label = expanded ? 'Back to chat' : 'Expand browser';
  const labelled = expanded;
  return (
    <Button
      size={labelled ? 'sm' : 'icon-sm'}
      variant="ghost"
      className="browser-expand"
      aria-label={label}
      aria-keyshortcuts={labelled ? 'Escape' : undefined}
      title={labelled ? `${label} (Esc)` : label}
      onClick={toggle}
    >
      {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      {labelled ? <span className="browser-control-label">{label}</span> : null}
      {labelled ? (
        <Kbd className="browser-expand-kbd" aria-hidden="true">
          Esc
        </Kbd>
      ) : null}
    </Button>
  );
};
