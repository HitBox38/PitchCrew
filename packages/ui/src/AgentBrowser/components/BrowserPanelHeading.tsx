import { X } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { cn } from '@pitchcrew/design-system/utils';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { browserStatus } from '../helpers.ts';
import { browserModeChip, type BrowserPanelView } from '../layout.ts';
import { BrowserAgentPicker } from './BrowserAgentPicker.tsx';
import { BrowserTaskDetails } from './BrowserTaskDetails.tsx';
import { BrowserControls } from './BrowserControls.tsx';
import { BrowserMaintenance } from './BrowserMaintenance.tsx';
import { BrowserExpandButton } from './BrowserExpandButton.tsx';
import { BrowserViewSwitch } from './BrowserViewSwitch.tsx';
export const BrowserPanelHeading = (
  props: Pick<AgentBrowserProps, 'browserPanel' | 'thread' | 'data' | 'onThread' | 'onOpenCard'> & {
    control: BrowserControl;
    narrow: boolean;
    expanded: boolean;
    toggleExpanded: () => void;
    /** Set when the panel offers the Packet | Browser switch. */
    view?: BrowserPanelView;
  },
) => {
  const { browserPanel, thread, control, narrow, expanded, toggleExpanded, view } = props;
  const waiting = props.data.computerApprovals.some(
    (approval) =>
      approval.roleId === browserPanel.role?.id &&
      approval.runId === browserPanel.session?.runId &&
      approval.status === 'pending',
  );
  const status = browserStatus(browserPanel.session, !!control.leaseId, waiting, thread);
  // The mode chip already says who is in control; the status stays for screen readers.
  const chip = browserModeChip(browserPanel.session, !!control.leaseId);
  return (
    <header className="browser-panel-heading" data-expanded={expanded || undefined}>
      <div className="browser-heading-identity">
        {view ? <BrowserViewSwitch view={view} setView={browserPanel.setView} /> : null}
        <BrowserAgentPicker browserPanel={browserPanel} data={props.data} />
        <output
          aria-live="polite"
          title={status.detail}
          className={cn(status.manual && 'browser-owner-manual', chip && 'sr-only') || undefined}
        >
          <span className="browser-state-dot" aria-hidden="true" />
          <span className="truncate">{status.label}</span>
        </output>
      </div>
      <div className="browser-heading-actions">
        <BrowserControls browserPanel={browserPanel} thread={thread} control={control} />
        <BrowserTaskDetails {...props} />
        <BrowserMaintenance browserPanel={browserPanel} thread={thread} control={control} />
        {!narrow ? <BrowserExpandButton expanded={expanded} toggle={toggleExpanded} /> : null}
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
      </div>
    </header>
  );
};
