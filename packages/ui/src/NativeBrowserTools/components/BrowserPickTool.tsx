import { SquareDashedMousePointer } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { useNativeBrowserTools } from '../hooks/useNativeBrowserTools.ts';

/** Pick one element on the page (DevTools-style highlight) and review it for the draft. */
export const BrowserPickTool = ({ model }: { model: ReturnType<typeof useNativeBrowserTools> }) => (
  <Button
    variant="ghost"
    size="sm"
    aria-label="Pick an element to attach"
    title="Pick an element on the page and attach it to your message"
    disabled={model.disabled || model.recording.recording || !window.pitchcrewBrowser?.pickElement}
    onClick={() => void model.pick()}
  >
    <SquareDashedMousePointer size={14} />
    <span className="browser-tool-label">Pick</span>
  </Button>
);
