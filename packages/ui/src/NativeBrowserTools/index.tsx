import type { useBrowserDevice } from '@/BrowserDeviceToolbar/useBrowserDevice.ts';
import { ScreenshotDialog } from './components/ScreenshotDialog.tsx';
import { BrowserRecording } from './components/BrowserRecording.tsx';
import { BrowserToolsActions } from './components/BrowserToolsActions.tsx';
import type { useNativeBrowserTools } from './hooks/useNativeBrowserTools.ts';

/** Page capture, recording, devices and floating; the panel lists the actions in Page settings
 * and keeps only a running recording's control on the toolbar. */
export const NativeBrowserTools = ({
  tools,
  device,
  onAttachBrowserFile,
}: {
  tools: ReturnType<typeof useNativeBrowserTools>;
  device: ReturnType<typeof useBrowserDevice>;
  onAttachBrowserFile?: (file: File) => void;
}) => {
  const { recording, error, capture } = tools;
  return (
    <div className="browser-tools">
      <BrowserToolsActions model={tools} device={device} />
      {recording.recording ? (
        <output className="sr-only">
          Recording the browser page. Stop when finished; recording stops automatically if control
          or the selected tab changes.
        </output>
      ) : null}
      <BrowserRecording model={recording} />
      {error || recording.error ? (
        <p role="alert" className="form-error">
          {error || recording.error}
        </p>
      ) : null}
      {capture ? (
        <ScreenshotDialog
          capture={capture}
          close={tools.closeCapture}
          onAttachBrowserFile={onAttachBrowserFile}
        />
      ) : null}
    </div>
  );
};
