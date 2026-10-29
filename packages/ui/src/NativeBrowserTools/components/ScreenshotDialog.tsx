import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea/index.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog/index.tsx';
import type { DesktopBrowserCapture } from '../../../../core/src/native-browser.ts';
import { useScreenshotCanvas } from '../hooks/useScreenshotCanvas.ts';
import { useScreenshotActions } from '../hooks/useScreenshotActions.ts';
import { ScreenshotActions } from './ScreenshotActions.tsx';

export const ScreenshotDialog = ({
  capture,
  close,
  onAttachBrowserFile,
}: {
  capture: DesktopBrowserCapture;
  close: () => void;
  onAttachBrowserFile?: (file: File) => void;
}) => {
  const [note, setNote] = useState('');
  const { canvas, ...editor } = useScreenshotCanvas(capture, note);
  const actions = useScreenshotActions(canvas, close, onAttachBrowserFile);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !actions.busy) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogTitle>Browser screenshot</DialogTitle>
        <DialogDescription>
          Draw on the page or add a note, then save it or attach it to your message draft.
        </DialogDescription>
        <div className="browser-screenshot-editor">
          <canvas
            ref={canvas}
            aria-label="Annotate browser screenshot"
            className="w-full touch-none rounded border border-border"
            onPointerDown={editor.begin}
            onPointerMove={editor.move}
            onPointerUp={editor.end}
            onPointerCancel={editor.end}
          />
        </div>
        <Textarea
          aria-label="Screenshot note"
          placeholder="Add context for your crew…"
          rows={2}
          maxLength={2000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <ScreenshotActions
          editor={editor}
          actions={actions}
          note={note}
          setNote={setNote}
          attach={!!onAttachBrowserFile}
        />
        {actions.saved ? <output className="quiet text-xs">Screenshot saved.</output> : null}
        {actions.copied ? <output className="quiet text-xs">Screenshot copied.</output> : null}
        {editor.error || actions.error ? (
          <p role="alert" className="form-error">
            {editor.error || actions.error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
