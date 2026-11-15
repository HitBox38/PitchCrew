import { FileText, Globe } from 'lucide-react';
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from '@pitchcrew/design-system/tabs';
import type { BrowserPanelView } from '../layout.ts';

export const browserPagePanelId = 'agent-browser-page';
export const browserPacketPanelId = 'agent-browser-packet';

/** The right panel's Packet | Browser switch. The browser region stays mounted
 * (hidden, so its native guest parks) while the packet is shown. */
export const BrowserViewSwitch = ({
  view,
  setView,
}: {
  view: BrowserPanelView;
  setView: (view: BrowserPanelView) => void;
}) => (
  <Tabs
    value={view}
    onValueChange={(value) => setView(value === 'packet' ? 'packet' : 'browser')}
    className="browser-view-switch-root"
  >
    <TabsList className="browser-view-switch" aria-label="Side panel view">
      <TabsTrigger
        value="packet"
        id={`${browserPacketPanelId}-tab`}
        aria-controls={browserPacketPanelId}
      >
        <FileText size={13} aria-hidden="true" /> Packet
      </TabsTrigger>
      <TabsTrigger
        value="browser"
        id={`${browserPagePanelId}-tab`}
        aria-controls={browserPagePanelId}
      >
        <Globe size={13} aria-hidden="true" /> Browser
      </TabsTrigger>
      <TabsIndicator />
    </TabsList>
  </Tabs>
);
