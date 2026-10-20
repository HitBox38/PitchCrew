import type { BrowserFrame } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import type { useBrowserSize } from '../hooks/useBrowserSize.ts';
import { BrowserView } from './BrowserView.tsx';
import { BrowserDialog } from './BrowserDialog.tsx';
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
      <div className="browser-live-view" ref={attach}>
        {frame ? (
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
          <div className="browser-empty">
            <p>
              {browserPanel.session?.status === 'open'
                ? 'Connecting to the browser…'
                : `Ask ${browserPanel.role!.name} to browse, or open a browser to sign in first.`}
            </p>
            <p className="quiet">
              This agent keeps separate sign-ins. New tasks start with a fresh tab.
            </p>
            {browserPanel.session?.status !== 'open' ? (
              <Button size="sm" disabled={control.working} onClick={() => void control.open()}>
                Open browser
              </Button>
            ) : null}
          </div>
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
