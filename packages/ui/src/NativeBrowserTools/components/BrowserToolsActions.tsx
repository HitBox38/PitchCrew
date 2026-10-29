import { Camera, PictureInPicture2, Smartphone, Square, Video } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { useBrowserDevice } from '@/BrowserDeviceToolbar/useBrowserDevice.ts';
import type { useNativeBrowserTools } from '../hooks/useNativeBrowserTools.ts';

export const BrowserToolsActions = ({
  model,
  device,
}: {
  model: ReturnType<typeof useNativeBrowserTools>;
  device: ReturnType<typeof useBrowserDevice>;
}) => {
  const { disabled, recording, tab, screenshot, floating } = model;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        aria-label="Toggle browser device toolbar"
        aria-pressed={device.open}
        disabled={disabled}
        onClick={() => device.setOpen(!device.open)}
      >
        <Smartphone size={14} />
        Devices
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Capture browser screenshot"
        disabled={disabled || recording.recording || !window.pitchcrewBrowser?.capture}
        onClick={() => void screenshot()}
      >
        <Camera size={14} />
        Screenshot
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label={
          recording.recording
            ? 'Stop browser recording'
            : recording.clip
              ? 'Review browser recording'
              : 'Record browser page'
        }
        disabled={
          !recording.recording &&
          (disabled || typeof MediaRecorder === 'undefined' || !window.pitchcrewBrowser?.capture)
        }
        onClick={() => {
          if (recording.recording) recording.stop();
          else if (recording.clip) recording.review();
          else void recording.start();
        }}
      >
        {recording.recording ? <Square size={14} /> : <Video size={14} />}
        {recording.recording ? 'Stop recording' : recording.clip ? 'Recording' : 'Record'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label={
          tab?.floating ? 'Close separate browser window' : 'Open separate browser window'
        }
        aria-pressed={!!tab?.floating}
        disabled={disabled || !window.pitchcrewBrowser?.floating}
        onClick={() => void floating()}
      >
        <PictureInPicture2 size={14} />
        Float
      </Button>
    </div>
  );
};
