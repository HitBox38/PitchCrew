import { SquareDashedMousePointer } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { useNativeBrowserTools } from '../hooks/useNativeBrowserTools.ts';

/**
 * A toolbar toggle: pick one element on the page and review it for the message draft. Pressed
 * while picking; pressing it again (or Escape on the page) cancels.
 */
export const BrowserPickTool = ({ model }: { model: ReturnType<typeof useNativeBrowserTools> }) => (
  <Button
    size="icon-sm"
    variant="ghost"
    className="browser-pick-toggle"
    aria-label={model.picking ? 'Cancel picking (Esc)' : 'Pick an element to attach'}
    title={model.picking ? 'Cancel picking (Esc)' : 'Pick an element to attach to your message'}
    aria-pressed={model.picking}
    disabled={
      !model.picking &&
      (model.disabled || model.recording.recording || !window.pitchcrewBrowser?.pickElement)
    }
    onClick={() => (model.picking ? model.cancelPick() : void model.pick())}
  >
    <SquareDashedMousePointer size={15} />
  </Button>
);
