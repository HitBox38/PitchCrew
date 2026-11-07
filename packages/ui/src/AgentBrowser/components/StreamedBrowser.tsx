import { BrowserToolbar } from './BrowserToolbar.tsx';
import { BrowserPage } from './BrowserPage.tsx';
import { BrowserManualInput } from './BrowserManualInput.tsx';
import type { BrowserFrame } from '@pitchcrew/core';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import type { useBrowserSize } from '../hooks/useBrowserSize.ts';
import type { useBrowserPresentation } from '../hooks/useBrowserPresentation.ts';
export const StreamedBrowser = ({
  browserPanel,
  control,
  viewport,
  frame,
  presentation,
}: Pick<AgentBrowserProps, 'browserPanel'> & {
  control: BrowserControl;
  viewport: ReturnType<typeof useBrowserSize>;
  frame: BrowserFrame | null;
  presentation: ReturnType<typeof useBrowserPresentation>;
}) => (
  <>
    {browserPanel.session?.status === 'open' ? (
      <BrowserToolbar
        frame={frame}
        control={control}
        url={browserPanel.session?.url ?? ''}
        zoom={presentation.zoom}
        setZoom={presentation.setZoom}
        panView={presentation.panView}
        setPanView={presentation.setPanView}
      />
    ) : null}
    <BrowserPage
      viewport={viewport}
      browserPanel={browserPanel}
      control={control}
      frame={frame}
      zoom={presentation.zoom}
      panView={presentation.panView}
    />
    {control.leaseId ? <BrowserManualInput key={control.leaseId} control={control} /> : null}
  </>
);
