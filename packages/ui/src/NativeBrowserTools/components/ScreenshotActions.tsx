import { Button } from '@/components/ui/button/components/Button.tsx';
import type { useScreenshotActions } from '../hooks/useScreenshotActions.ts';
import type { useScreenshotCanvas } from '../hooks/useScreenshotCanvas.ts';

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
    <Button
      size="sm"
      variant="outline"
      disabled={!editor.strokes || actions.busy}
      onClick={editor.undo}
    >
      Undo mark
    </Button>
    <Button
      size="sm"
      variant="outline"
      disabled={(!editor.strokes && !note) || actions.busy}
      onClick={() => {
        editor.clear();
        setNote('');
      }}
    >
      Clear annotations
    </Button>
    <Button size="sm" disabled={!editor.ready || actions.busy} onClick={() => void actions.save()}>
      Save PNG
    </Button>
    <Button
      size="sm"
      variant="outline"
      disabled={!editor.ready || actions.busy || !window.pitchcrewBrowser?.copyCapture}
      onClick={() => void actions.copy()}
    >
      Copy image
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
    {actions.saved ? (
      <Button size="sm" variant="outline" onClick={actions.reveal}>
        Show saved screenshot
      </Button>
    ) : null}
  </div>
);
