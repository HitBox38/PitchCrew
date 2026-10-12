import { useBrowserSize } from './hooks/useBrowserSize.ts';
import { BrowserPanelHeading } from './components/BrowserPanelHeading.tsx';
import { BrowserApprovals } from './components/BrowserApprovals.tsx';
import { BrowserResizer } from './components/BrowserResizer.tsx';
import { BrowserSurface } from './components/BrowserSurface.tsx';
import { BrowserPage } from './components/BrowserPage.tsx';
import { BrowserToolbar } from './components/BrowserToolbar.tsx';
import { BrowserManualInput } from './components/BrowserManualInput.tsx';
import { useBrowserFrame } from './hooks/useBrowserFrame.ts';
import { useBrowserControl } from './hooks/useBrowserControl.ts';
import { useBrowserPresentation } from './hooks/useBrowserPresentation.ts';
import type { AgentBrowserProps } from './types.ts';

export function AgentBrowser(props: AgentBrowserProps) {
  const { browserPanel, thread } = props;
  const roleId = browserPanel.role?.id ?? '';
  const control = useBrowserControl(roleId, thread, browserPanel.refresh);
  const presentation = useBrowserPresentation();
  const enabled = !props.hidden && browserPanel.open && browserPanel.session?.status === 'open';
  const viewport = useBrowserSize(enabled, control.resize);
  const stream = useBrowserFrame(roleId, thread, enabled);
  if (props.hidden || !browserPanel.available || !browserPanel.role) return null;
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
      <BrowserToolbar
        frame={frame}
        control={control}
        url={browserPanel.session?.url ?? ''}
        zoom={presentation.zoom}
        setZoom={presentation.setZoom}
        panView={presentation.panView}
        setPanView={presentation.setPanView}
      />
      {error ? (
        <p className="form-error px-4" role="alert">
          {error}
        </p>
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
      <BrowserApprovals {...props} control={control} />
    </BrowserSurface>
  );
}
