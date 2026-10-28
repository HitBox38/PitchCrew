import type { BrowserFrame } from '@pitchcrew/core';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import type { useBrowserSize } from '../hooks/useBrowserSize.ts';
import { BrowserView } from './BrowserView.tsx';
import { BrowserDialog } from './BrowserDialog.tsx';
import { BrowserPlaceholder } from './BrowserPlaceholder.tsx';
import { isBlankBrowserPage } from '../page-state.ts';
export const BrowserPage = ({
  browserPanel,
  viewport: { attach, size },
  control,
  frame,
  zoom,
  panView,
}: Pick<AgentBrowserProps, 'browserPanel'> & {
  viewport: ReturnType<typeof useBrowserSize>;
  control: BrowserControl;
  frame: BrowserFrame | null;
  zoom: number;
  panView: boolean;
}) => {
  return (
    <div className="browser-panel-body">
      {frame?.warning ? <p className="browser-dialog">{frame.warning}</p> : null}
      {frame?.status === 'fallback' ? (
        <output className="quiet block px-4">Browser view is updating at a reduced rate.</output>
      ) : null}
      <div className="browser-live-view" ref={attach}>
        {frame?.screenshot && !isBlankBrowserPage(frame.url, frame.title) ? (
          <BrowserView
            size={size}
            frame={frame}
            manual={!!control.leaseId}
            control={control}
            name={browserPanel.role!.name}
            zoom={zoom}
            panView={panView}
          />
        ) : (
          <BrowserPlaceholder
            loading={
              control.working ||
              frame?.status === 'loading' ||
              (browserPanel.session?.status === 'open' && !frame)
            }
            opened={browserPanel.session?.status === 'open'}
            name={browserPanel.role!.name}
            control={control}
          />
        )}
      </div>
      {frame?.dialog ? (
        <BrowserDialog
          key={`${frame.dialog.type}:${frame.dialog.message}`}
          dialog={frame.dialog}
          control={control}
        />
      ) : null}
    </div>
  );
};
