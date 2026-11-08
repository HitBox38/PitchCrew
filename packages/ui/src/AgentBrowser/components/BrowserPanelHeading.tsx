import { X } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { browserState, type BrowserPanelView } from '../layout.ts';
import { BrowserAgentPicker } from './BrowserAgentPicker.tsx';
import { BrowserTaskDetails } from './BrowserTaskDetails.tsx';
import { BrowserMaintenance } from './BrowserMaintenance.tsx';
import { BrowserExpandButton } from './BrowserExpandButton.tsx';
import { BrowserViewSwitch } from './BrowserViewSwitch.tsx';
import { NativeBrowserTabs } from './NativeBrowserTabs.tsx';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import { useBrowserPresence } from '@/DesktopBrowserHost/presence.ts';

/**
 * One header row: who and which state, the page's tabs, then the panel's actions. The control
 * action lives in the tray, so nothing here changes width when control changes hands.
 */
export const BrowserPanelHeading = (
  props: Pick<AgentBrowserProps, 'browserPanel' | 'thread' | 'data' | 'onThread' | 'onOpenCard'> & {
    control: BrowserControl;
    narrow: boolean;
    expanded: boolean;
    toggleExpanded: () => void;
    /** Set when the panel offers the Packet | Browser switch. */
    view?: BrowserPanelView;
    /** The native page model whose tabs show inline. */
    native?: NativeBrowserModel;
    nudged: boolean;
  },
) => {
  const { browserPanel, thread, control, narrow, expanded, toggleExpanded, view } = props;
  const session = browserPanel.session;
  const waiting = props.data.computerApprovals.some(
    (approval) =>
      approval.roleId === browserPanel.role?.id &&
      approval.runId === session?.runId &&
      approval.status === 'pending',
  );
  const { picking } = useBrowserPresence();
  const current = browserState({
    session,
    leaseId: control.leaseId,
    implicit: control.implicit,
    waiting,
    opening: control.working && session?.status !== 'open',
    name: browserPanel.role?.name ?? 'The agent',
    elsewhere: !!session?.threadId && session.threadId !== thread,
  });
  const state = picking
    ? {
        tone: 'control' as const,
        label: 'Picking',
        detail: 'Click an element on the page to attach it to your message. Esc cancels.',
      }
    : current;
  return (
    <header className="browser-panel-heading" data-expanded={expanded || undefined}>
      <div className="browser-heading-identity">
        {view ? <BrowserViewSwitch view={view} setView={browserPanel.setView} /> : null}
        <BrowserAgentPicker browserPanel={browserPanel} data={props.data} />
        <BrowserTaskDetails {...props} state={state} nudged={props.nudged} />
        <output className="sr-only" aria-live="polite">
          {state.label}
        </output>
      </div>
      {props.native ? (
        <div className="browser-heading-tabs">
          <NativeBrowserTabs model={props.native} manual={control.available && !control.working} />
        </div>
      ) : null}
      <div className="browser-heading-actions">
        <BrowserMaintenance browserPanel={browserPanel} thread={thread} control={control} />
        {!narrow ? <BrowserExpandButton expanded={expanded} toggle={toggleExpanded} /> : null}
        {!expanded || narrow ? (
          <Button
            size="icon-sm"
            variant="ghost"
            className="browser-hide"
            aria-label="Hide browser"
            title="Hide browser"
            onClick={browserPanel.hide}
          >
            <X size={15} />
          </Button>
        ) : null}
      </div>
    </header>
  );
};
