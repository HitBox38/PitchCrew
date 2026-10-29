import { useState, type RefObject } from 'react';
import { browserCanvasBlob, browserBlobBase64 } from '../media.ts';
import { chatAttachmentLimits } from '@pitchcrew/core/chat-attachments';

export const useScreenshotActions = (
  canvas: RefObject<HTMLCanvasElement | null>,
  close: () => void,
  attach?: (file: File) => void,
) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const run = async (operation: (blob: Blob) => Promise<void>) => {
    if (!canvas.current) return;
    setBusy(true);
    setError('');
    try {
      await operation(await browserCanvasBlob(canvas.current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The screenshot could not be exported.');
    } finally {
      setBusy(false);
    }
  };
  return {
    busy,
    error,
    saved,
    copied,
    copy: () =>
      run(async (blob) => {
        await window.pitchcrewBrowser!.copyCapture(await browserBlobBase64(blob));
        setCopied(true);
      }),
    save: () =>
      run(async (blob) => {
        setSaved(await window.pitchcrewBrowser!.saveArtifact('png', await browserBlobBase64(blob)));
      }),
    attach: () =>
      run(async (blob) => {
        if (!attach) return;
        if (blob.size > chatAttachmentLimits.bytes)
          throw new Error(
            'This screenshot is larger than the 10 MB attachment limit. Save it locally.',
          );
        attach(new File([blob], `browser-screenshot-${Date.now()}.png`, { type: 'image/png' }));
        close();
      }),
    reveal: () => {
      if (saved)
        void window
          .pitchcrewBrowser!.revealArtifact(saved)
          .catch((cause: unknown) =>
            setError(cause instanceof Error ? cause.message : 'The saved file is unavailable.'),
          );
    },
  };
};
