import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import type { BrowserControl } from '../types.ts';
import { NativeBrowserStatus } from './NativeBrowserStatus.tsx';
import { BrowserPlaceholder } from './BrowserPlaceholder.tsx';
import { BrowserPopup } from './BrowserPopup.tsx';
import { ClayControlBar } from './ClayControlBar.tsx';
import { ClayRecentPages } from './ClayRecentPages.tsx';

/** The page area: the live guest's host element with its error, popup and empty states. */
export const NativeBrowserBody = ({
  model,
  control,
  attach,
  empty,
  name,
}: {
  model: NativeBrowserModel;
  control: BrowserControl;
  attach: (element: HTMLDivElement | null) => void;
  empty: boolean;
  name?: string;
}) => {
  const tab = model.state?.tabs.find((item) => item.id === model.state?.activeTab);
  const manual = !!control.leaseId;
  // Idle browsing can start from these actions; the first one takes control.
  const ready = control.available && !control.working;
  return (
    <div className="browser-panel-body">
      {manual ? <ClayControlBar name={name} implicit={control.implicit} /> : null}
      <div className="browser-live-view" ref={attach} aria-label="Native browser page">
        <NativeBrowserStatus model={model} manual={ready} control={control} />
        {tab?.window ? (
          <BrowserPopup model={model} tabId={tab.id} manual={ready} />
        ) : !model.state || empty ? (
          <BrowserPlaceholder loading={!model.state} opened name={name} control={control}>
            <ClayRecentPages model={model} manual={ready} />
          </BrowserPlaceholder>
        ) : null}
      </div>
    </div>
  );
};
