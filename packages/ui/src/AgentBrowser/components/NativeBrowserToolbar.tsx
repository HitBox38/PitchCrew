import { BrowserPickTool } from '@/NativeBrowserTools/components/BrowserPickTool.tsx';
import { NativeBrowserSettings } from './NativeBrowserSettings.tsx';
import { ArrowLeft, ArrowRight, RotateCw, Square } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { BrowserAddress } from './BrowserAddress.tsx';
import { BrowserLoadingProgress } from './BrowserLoadingProgress.tsx';
import { NativeBrowserHistory } from './NativeBrowserHistory.tsx';
import { NativeBrowserFindPopover } from './NativeBrowserFindPopover.tsx';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import type { BrowserControl } from '../types.ts';
import type { useNativeBrowserTools } from '@/NativeBrowserTools/hooks/useNativeBrowserTools.ts';
import type { useBrowserDevice } from '@/BrowserDeviceToolbar/useBrowserDevice.ts';
import { browserShortcut } from '../helpers.ts';
export const NativeBrowserToolbar = ({
  model,
  control,
  tools,
  device,
}: {
  model: NativeBrowserModel;
  control: BrowserControl;
  tools: ReturnType<typeof useNativeBrowserTools>;
  device: ReturnType<typeof useBrowserDevice>;
}) => {
  const tab = model.state?.tabs.find((item) => item.id === model.state?.activeTab);
  // Idle browsing: page commands take control on first use. A running agent needs takeover.
  const manual = control.available && !control.working;
  return (
    <div className="browser-toolbar" data-loading={!!tab?.loading}>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Back"
        title="Back (Alt+←)"
        disabled={!manual || !tab?.canGoBack}
        onClick={() => void model.command({ kind: 'back' })}
      >
        <ArrowLeft size={15} />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Forward"
        title="Forward (Alt+→)"
        disabled={!manual || !tab?.canGoForward}
        onClick={() => void model.command({ kind: 'forward' })}
      >
        <ArrowRight size={15} />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={tab?.loading ? 'Stop loading' : 'Reload page'}
        title={tab?.loading ? 'Stop loading' : `Reload (${browserShortcut('r')})`}
        disabled={!manual}
        onClick={() => void model.command({ kind: tab?.loading ? 'stop' : 'reload' })}
      >
        {tab?.loading ? <Square size={15} /> : <RotateCw size={15} />}
      </Button>
      <BrowserAddress
        frame={null}
        control={control}
        url={tab?.navigationUrl ?? tab?.url ?? ''}
        contextId={tab?.id}
        // Only a committed HTTPS page that loaded earns the lock.
        secure={!!tab?.url.startsWith('https:') && !tab.error && !tab.navigationUrl}
        onNavigate={() => {
          void window.pitchcrewBrowser?.focusPage(model.identity!.id).catch(() => {});
        }}
        onOpenExternal={() => void model.command({ kind: 'open-external' })}
      />
      <BrowserPickTool model={tools} />
      <NativeBrowserFindPopover model={model} manual={manual} />
      <NativeBrowserHistory model={model} manual={manual} />
      <NativeBrowserSettings model={model} manual={manual} tools={tools} device={device} />
      {tab?.loading ? <BrowserLoadingProgress /> : null}
    </div>
  );
};
