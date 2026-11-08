import { useBrowserDevice } from '@/BrowserDeviceToolbar/useBrowserDevice.ts';
import { useBrowserSize } from './hooks/useBrowserSize.ts';
import { BrowserPanelHeading } from './components/BrowserPanelHeading.tsx';
import { BrowserApprovals } from './components/BrowserApprovals.tsx';
import { BrowserResizer } from './components/BrowserResizer.tsx';
import { BrowserSurface } from './components/BrowserSurface.tsx';
import { BrowserContent } from './components/BrowserContent.tsx';
import { BrowserPacketView } from './components/BrowserPacketView.tsx';
import { BrowserExpandedSide } from './components/BrowserExpandedSide.tsx';
import { useNativeBrowser } from './hooks/useNativeBrowser.ts';
import { useBrowserFrame } from './hooks/useBrowserFrame.ts';
import { useBrowserControl } from './hooks/useBrowserControl.ts';
import { useBrowserPresentation } from './hooks/useBrowserPresentation.ts';
import type { AgentBrowserProps } from './types.ts';
import { useBrowserApprovalVisibility } from './hooks/useBrowserApprovalVisibility.ts';
import { useBrowserLayout } from './hooks/useBrowserLayout.ts';
import { useBrowserHandback } from './hooks/useBrowserHandback.ts';

export const AgentBrowser = (props: AgentBrowserProps) => {
  useBrowserApprovalVisibility(props);
  const { browserPanel, thread } = props;
  const roleId = browserPanel.role?.id ?? '';
  const session = browserPanel.session;
  const control = useBrowserControl(
    roleId,
    thread,
    browserPanel.refresh,
    props.conversation?.cardId,
    // No agent run is using this browser: the user can browse without Take control first.
    session?.status === 'open' && !session.runId,
  );
  const presentation = useBrowserPresentation();
  const layout = useBrowserLayout(props, presentation);
  const { packet, view, switchable, sideColumn, modal, toggleExpanded } = layout;
  const enabled = browserPanel.open && browserPanel.session?.status === 'open';
  const native = useNativeBrowser(roleId, thread, browserPanel.session?.native, enabled, control);
  const { nudged } = useBrowserHandback(control, session, native.identity?.id);
  const selectedTab = native.state?.tabs.find((tab) => tab.id === native.state?.activeTab);
  const device = useBrowserDevice(
    `${native.identity?.id}:${selectedTab?.logicalId ?? native.state?.activeTab}`,
  );
  const viewport = useBrowserSize(
    enabled && !control.working && !native.pending && (!native.active || !!native.state),
    control.resize,
    device.setting,
  );
  const live = enabled && !native.active && !native.pending && view === 'browser';
  const stream = useBrowserFrame(roleId, thread, live);
  if (!browserPanel.available || !browserPanel.role) return null;
  const error = control.error || viewport.error || stream.error || browserPanel.error;
  const approvals = (
    <BrowserApprovals
      {...props}
      control={control}
      reserveSpace={
        view === 'browser' && !!browserPanel.session?.native && !!browserPanel.session.runId
      }
    />
  );
  return (
    <BrowserSurface
      modal={modal}
      open={browserPanel.open}
      name={browserPanel.role.name}
      hide={layout.dismiss}
    >
      {!modal ? <BrowserResizer browserPanel={browserPanel} /> : null}
      <BrowserPanelHeading
        {...props}
        control={control}
        narrow={presentation.narrow}
        expanded={presentation.expanded}
        view={switchable ? view : undefined}
        toggleExpanded={toggleExpanded}
      />
      {error ? (
        <p className="form-error px-4" role="alert">
          {error}
        </p>
      ) : null}
      <BrowserContent
        {...props}
        hidden={view === 'packet'}
        tabPanel={switchable}
        native={native}
        control={control}
        viewport={viewport}
        device={device}
        frame={stream.frame}
        presentation={presentation}
        nudged={nudged}
      />
      {view === 'packet' && packet ? <BrowserPacketView {...packet} /> : null}
      {sideColumn ? <BrowserExpandedSide {...props} approvals={approvals} /> : approvals}
    </BrowserSurface>
  );
};
