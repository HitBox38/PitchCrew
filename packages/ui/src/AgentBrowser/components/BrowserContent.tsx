import type { BrowserFrame } from '@pitchcrew/core';
import type { useBrowserDevice } from '@/BrowserDeviceToolbar/useBrowserDevice.ts';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import type { useBrowserSize } from '../hooks/useBrowserSize.ts';
import type { useBrowserPresentation } from '../hooks/useBrowserPresentation.ts';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { NativeBrowser } from './NativeBrowser.tsx';
import { StreamedBrowser } from './StreamedBrowser.tsx';
import { browserPagePanelId } from './BrowserViewSwitch.tsx';

/**
 * The page region. It is always this same element (display: contents) so switching to the clay
 * Packet tab only hides it: the native guest's mount collapses and the guest parks through the
 * existing null-bounds path instead of unmounting, and the page viewport keeps its size.
 */
export const BrowserContent = ({
  hidden,
  tabPanel,
  native,
  control,
  viewport,
  device,
  frame,
  presentation,
  browserPanel,
  onAttachBrowserFile,
  nudged,
}: Pick<AgentBrowserProps, 'browserPanel' | 'onAttachBrowserFile'> & {
  /** A press on the read-only page while the agent works: point at Take control. */
  nudged: boolean;
  hidden: boolean;
  tabPanel: boolean;
  native: NativeBrowserModel;
  control: BrowserControl;
  viewport: ReturnType<typeof useBrowserSize>;
  device: ReturnType<typeof useBrowserDevice>;
  frame: BrowserFrame | null;
  presentation: ReturnType<typeof useBrowserPresentation>;
}) => (
  <div
    className="browser-page-region"
    hidden={hidden}
    id={tabPanel ? browserPagePanelId : undefined}
    role={tabPanel ? 'tabpanel' : undefined}
    aria-labelledby={tabPanel ? `${browserPagePanelId}-tab` : undefined}
  >
    {native.active ? (
      <NativeBrowser
        model={native}
        name={browserPanel.role?.name}
        control={control}
        viewport={viewport}
        device={device}
        nudged={nudged}
        onAttachBrowserFile={onAttachBrowserFile}
      />
    ) : (
      <StreamedBrowser
        browserPanel={browserPanel}
        control={control}
        viewport={viewport}
        frame={frame}
        presentation={presentation}
      />
    )}
  </div>
);
