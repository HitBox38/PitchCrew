import type { NativeBrowserModel } from '@/AgentBrowser/hooks/useNativeBrowser.ts';
import type { BrowserControl } from '@/AgentBrowser/types.ts';
import type { useBrowserDevice } from '@/BrowserDeviceToolbar/useBrowserDevice.ts';
import { ScreenshotDialog } from './components/ScreenshotDialog.tsx';
import { BrowserRecording } from './components/BrowserRecording.tsx';
import { BrowserToolsActions } from './components/BrowserToolsActions.tsx';
import { useNativeBrowserTools } from './hooks/useNativeBrowserTools.ts';

export const NativeBrowserTools = ({
  model,
  control,
  device,
  onAttachBrowserFile,
}: {
  model: NativeBrowserModel;
  control: BrowserControl;
  device: ReturnType<typeof useBrowserDevice>;
  onAttachBrowserFile?: (file: File) => void;
}) => {
  const tools = useNativeBrowserTools(model, control);
  const { recording, error, capture } = tools;
  return (
    <div className="browser-tools border-b px-3 py-1.5">
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
