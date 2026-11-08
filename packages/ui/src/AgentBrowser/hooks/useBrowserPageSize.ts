import { useBrowserDevice } from '@/BrowserDeviceToolbar/useBrowserDevice.ts';
import { useBrowserSize } from './useBrowserSize.ts';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import type { NativeBrowserModel } from './useNativeBrowser.ts';

/**
 * The page's device setting and viewport. While a request waits, the page keeps the size it was
 * inspected at: expanding or resizing the panel shows it centred instead of resizing it, which
 * would void the request. It follows the panel again once the request is decided.
 */
export const useBrowserPageSize = (
  { browserPanel, data }: Pick<AgentBrowserProps, 'browserPanel' | 'data'>,
  control: BrowserControl,
  native: NativeBrowserModel,
  enabled: boolean,
) => {
  const session = browserPanel.session;
  const selectedTab = native.state?.tabs.find((tab) => tab.id === native.state?.activeTab);
  const device = useBrowserDevice(
    `${native.identity?.id}:${selectedTab?.logicalId ?? native.state?.activeTab}`,
  );
  const waiting = data.computerApprovals.some(
    (approval) =>
      approval.status === 'pending' &&
      approval.roleId === browserPanel.role?.id &&
      approval.runId === session?.runId,
  );
  const viewport = useBrowserSize(
    enabled &&
      !waiting &&
      !control.working &&
      !native.pending &&
      (!native.active || !!native.state),
    control.resize,
    device.setting,
  );
  return { device, viewport };
};
