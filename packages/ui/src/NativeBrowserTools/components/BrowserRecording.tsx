import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog/index.tsx';
import type { useBrowserRecording } from '../hooks/useBrowserRecording.ts';

export const BrowserRecording = ({ model }: { model: ReturnType<typeof useBrowserRecording> }) => {
  if (!model.clip || !model.source) return null;
  return (
    <Dialog
      open={model.reviewing}
      onOpenChange={(open) => {
        if (!open && !model.busy) model.closeReview();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogTitle>Browser recording</DialogTitle>
        <DialogDescription>
          Review the clip before saving. Only the browser page is recorded, without audio. Videos
          save locally.
        </DialogDescription>
        <video
          src={model.source}
          controls
          muted
          aria-label="Review recorded browser page"
          className="max-h-[55dvh] w-full rounded"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={model.busy} onClick={() => void model.save()}>
            Save WebM recording
          </Button>
          {model.saved ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void window.pitchcrewBrowser?.revealArtifact(model.saved!).catch(() => {})
              }
            >
              Show saved recording
            </Button>
          ) : null}
          <Button size="sm" variant="outline" disabled={model.busy} onClick={model.discard}>
            Discard recording
          </Button>
        </div>
        {model.saved ? <output className="quiet text-xs">Recording saved.</output> : null}
      </DialogContent>
    </Dialog>
  );
};
