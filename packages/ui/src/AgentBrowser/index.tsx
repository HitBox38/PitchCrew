import { useBrowserDevice } from '@/BrowserDeviceToolbar/useBrowserDevice.ts';
import { useBrowserSize } from './hooks/useBrowserSize.ts';
import { BrowserPanelHeading } from './components/BrowserPanelHeading.tsx';
import { BrowserApprovals } from './components/BrowserApprovals.tsx';
import { BrowserResizer } from './components/BrowserResizer.tsx';
import { BrowserSurface } from './components/BrowserSurface.tsx';
import { NativeBrowser } from './components/NativeBrowser.tsx';
import { StreamedBrowser } from './components/StreamedBrowser.tsx';
import { useNativeBrowser } from './hooks/useNativeBrowser.ts';
import { useBrowserFrame } from './hooks/useBrowserFrame.ts';
import { useBrowserControl } from './hooks/useBrowserControl.ts';
import { useBrowserPresentation } from './hooks/useBrowserPresentation.ts';
import type { AgentBrowserProps } from './types.ts';
import { useBrowserApprovalVisibility } from './hooks/useBrowserApprovalVisibility.ts';

export const AgentBrowser = (props: AgentBrowserProps) => {
  useBrowserApprovalVisibility(props);
  const { browserPanel, thread } = props;
  const roleId = browserPanel.role?.id ?? '';
  const control = useBrowserControl(
    roleId,
    thread,
    browserPanel.refresh,
    props.conversation?.cardId,
  );
  const presentation = useBrowserPresentation();
  const enabled = browserPanel.open && browserPanel.session?.status === 'open';
  const native = useNativeBrowser(roleId, thread, browserPanel.session?.native, enabled, control);
  const selectedTab = native.state?.tabs.find((tab) => tab.id === native.state?.activeTab);
  const device = useBrowserDevice(
    `${native.identity?.id}:${selectedTab?.logicalId ?? native.state?.activeTab}`,
  );
  const viewport = useBrowserSize(
    enabled && !control.working && !native.pending && (!native.active || !!native.state),
    control.resize,
    device.setting,
  );
  const stream = useBrowserFrame(roleId, thread, enabled && !native.active && !native.pending);
  if (!browserPanel.available || !browserPanel.role) return null;
  const role = browserPanel.role;
  const frame = stream.frame;
  const error = control.error || viewport.error || stream.error || browserPanel.error;
  const modal = presentation.narrow || presentation.expanded;
  return (
    <BrowserSurface
      modal={modal}
      open={browserPanel.open}
      name={role.name}
      hide={browserPanel.hide}
    >
      {!modal ? <BrowserResizer browserPanel={browserPanel} /> : null}
      <BrowserPanelHeading
        {...props}
        control={control}
        narrow={presentation.narrow}
        expanded={presentation.expanded}
        waiting={props.data.computerApprovals.some(
          (approval) =>
            approval.roleId === role.id &&
            approval.runId === browserPanel.session?.runId &&
            approval.status === 'pending',
        )}
        toggleExpanded={() => presentation.setExpanded(!presentation.expanded)}
      />
      {error ? (
        <p className="form-error px-4" role="alert">
          {error}
        </p>
      ) : null}
      {native.active ? (
        <NativeBrowser
          model={native}
          control={control}
          viewport={viewport}
          device={device}
          onAttachBrowserFile={props.onAttachBrowserFile}
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
      <BrowserApprovals
        {...props}
        control={control}
        reserveSpace={!!browserPanel.session?.native && !!browserPanel.session.runId}
      />
    </BrowserSurface>
  );
};
