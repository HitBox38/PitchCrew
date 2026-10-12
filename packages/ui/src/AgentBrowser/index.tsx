import { BrowserPanelHeading } from './components/BrowserPanelHeading.tsx';
import { BrowserAgentTabs } from './components/BrowserAgentTabs.tsx';
import { BrowserTask } from './components/BrowserTask.tsx';
import { BrowserSites } from './components/BrowserSites.tsx';
import { BrowserModePicker } from './components/BrowserModePicker.tsx';
import { BrowserControls } from './components/BrowserControls.tsx';
import { BrowserDialog } from './components/BrowserDialog.tsx';
import { BrowserView } from './components/BrowserView.tsx';
import { BrowserApprovals } from './components/BrowserApprovals.tsx';
import { BrowserResizer } from './components/BrowserResizer.tsx';
import { useBrowserFrame } from './hooks/useBrowserFrame.ts';
import { useBrowserControl } from './hooks/useBrowserControl.ts';
import type { AgentBrowserProps } from './types.ts';

export function AgentBrowser(props: AgentBrowserProps) {
  const { browserPanel, thread, conversation, action, working } = props;
  const roleId = browserPanel.role?.id ?? '';
  const control = useBrowserControl(roleId, thread);
  const stream = useBrowserFrame(
    roleId,
    thread,
    !props.hidden && browserPanel.open && browserPanel.session?.status === 'open',
  );
  if (props.hidden || !browserPanel.open || !browserPanel.role) return null;
  const role = browserPanel.role;
  const frame = stream.frame;
  const error = control.error || stream.error || browserPanel.error;
  return (
    <aside
      id="agent-browser-panel"
      className="agent-browser-panel"
      aria-label={`${role.name} browser`}
    >
      <BrowserResizer browserPanel={browserPanel} />
      <BrowserPanelHeading browserPanel={browserPanel} />
      <BrowserAgentTabs {...props} />
      <BrowserTask {...props} />
      <div className="browser-permissions">
        <BrowserModePicker
          role={role}
          conversation={conversation}
          disabled={working}
          save={(patch) => void action(`/conversations/${thread}`, 'PUT', patch).catch(() => {})}
        />
        <span className="quiet">Changes apply to the next turn.</span>
      </div>
      <BrowserControls
        browserPanel={browserPanel}
        thread={thread}
        control={control}
        frame={frame}
      />
      {error ? (
        <p className="form-error px-4" role="alert">
          {error}
        </p>
      ) : null}
      <div className="browser-panel-body">
        <BrowserSites browserPanel={browserPanel} thread={thread} control={control} />
        {frame?.warning ? <p className="browser-dialog">{frame.warning}</p> : null}
        {frame ? (
          <>
            <p className="browser-location" title={frame.url}>
              {frame.title || 'New browser'} · {frame.url}
            </p>
            <BrowserView
              frame={frame}
              manual={!!control.leaseId}
              control={control}
              name={role.name}
            />
            {frame.dialog ? (
              <BrowserDialog
                key={`${frame.dialog.type}:${frame.dialog.message}`}
                dialog={frame.dialog}
                control={control}
              />
            ) : null}
          </>
        ) : (
          <div className="browser-empty">
            <p>
              {browserPanel.session?.status === 'open'
                ? 'Connecting to the browser…'
                : 'Open a browser here, or ask this agent to browse.'}
            </p>
            <p className="quiet">
              Each agent has separate sign-ins. New jobs and conversations start with a fresh tab.
            </p>
          </div>
        )}
        <BrowserApprovals {...props} control={control} />
      </div>
    </aside>
  );
}
