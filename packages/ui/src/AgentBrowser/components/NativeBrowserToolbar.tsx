import { NativeBrowserSettings } from './NativeBrowserSettings.tsx';
import { ArrowLeft, ArrowRight, RotateCw, Search, Square } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { BrowserAddress } from './BrowserAddress.tsx';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import type { BrowserControl } from '../types.ts';
export const NativeBrowserToolbar = ({
  model,
  control,
}: {
  model: NativeBrowserModel;
  control: BrowserControl;
}) => {
  const tab = model.state?.tabs.find((item) => item.id === model.state?.activeTab);
  const manual = !!control.leaseId && !control.working;
  return (
    <div className="browser-toolbar">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Back"
        disabled={!manual || !tab?.canGoBack}
        onClick={() => void model.command({ kind: 'back' })}
      >
        <ArrowLeft size={15} />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Forward"
        disabled={!manual || !tab?.canGoForward}
        onClick={() => void model.command({ kind: 'forward' })}
      >
        <ArrowRight size={15} />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={tab?.loading ? 'Stop loading' : 'Reload page'}
        disabled={!manual}
        onClick={() => void model.command({ kind: tab?.loading ? 'stop' : 'reload' })}
      >
        {tab?.loading ? <Square size={15} /> : <RotateCw size={15} />}
      </Button>
      <BrowserAddress
        frame={null}
        control={control}
        url={tab?.url ?? ''}
        contextId={tab?.id}
        onNavigate={() => {
          void window.pitchcrewBrowser?.focusPage(model.identity!.id).catch(() => {});
        }}
      />
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Find on page"
        disabled={!manual}
        onClick={() => model.setFindOpen(!model.findOpen)}
      >
        <Search size={15} />
      </Button>
      <NativeBrowserSettings model={model} manual={manual} />
    </div>
  );
};
