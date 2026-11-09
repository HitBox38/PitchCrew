import { Button } from '@pitchcrew/design-system/button';
import type { useScreenshotActions } from '../hooks/useScreenshotActions.ts';
import type { useScreenshotCanvas } from '../hooks/useScreenshotCanvas.ts';

/**
 * One glaze action per surface: Attach to message when a draft can take it (Save PNG otherwise),
 * with copy and save as quiet secondary actions on the right. Undo and Clear appear only once
 * there is something to undo or clear.
 */
export const ScreenshotActions = ({
  editor,
  actions,
  note,
  setNote,
  attach,
}: {
  editor: Omit<ReturnType<typeof useScreenshotCanvas>, 'canvas'>;
  actions: ReturnType<typeof useScreenshotActions>;
  note: string;
  setNote: (note: string) => void;
  attach: boolean;
}) => (
  <div className="flex flex-wrap items-center gap-2">
    {editor.strokes ? (
      <Button size="sm" variant="ghost" disabled={actions.busy} onClick={editor.undo}>
        Undo mark
      </Button>
    ) : null}
    {editor.strokes || note ? (
      <Button
        size="sm"
        variant="ghost"
        disabled={actions.busy}
        onClick={() => {
          editor.clear();
          setNote('');
        }}
      >
        Clear annotations
      </Button>
    ) : null}
    <span className="ml-auto flex flex-wrap items-center gap-2">
      {actions.saved ? (
        <Button size="sm" variant="ghost" onClick={actions.reveal}>
          Show saved screenshot
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        disabled={!editor.ready || actions.busy || !window.pitchcrewBrowser?.copyCapture}
        onClick={() => void actions.copy()}
      >
        Copy image
      </Button>
      <Button
        size="sm"
        variant={attach ? 'outline' : 'default'}
        disabled={!editor.ready || actions.busy}
        onClick={() => void actions.save()}
      >
        Save PNG
      </Button>
      {attach ? (
        <Button
          size="sm"
          disabled={!editor.ready || actions.busy}
          onClick={() => void actions.attach()}
        >
          Attach to message
        </Button>
      ) : null}
    </span>
  </div>
);
