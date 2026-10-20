import { X, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { browserStatus } from '../helpers.ts';
import { BrowserAgentPicker } from './BrowserAgentPicker.tsx';
import { BrowserTaskDetails } from './BrowserTaskDetails.tsx';
import { BrowserControls } from './BrowserControls.tsx';
import { BrowserMaintenance } from './BrowserMaintenance.tsx';
export const BrowserPanelHeading = (
  props: Pick<AgentBrowserProps, 'browserPanel' | 'thread' | 'data' | 'onThread' | 'onOpenCard'> & {
    control: BrowserControl;
    narrow: boolean;
    expanded: boolean;
    toggleExpanded: () => void;
    waiting: boolean;
  },
) => {
  const { browserPanel, thread, control, narrow, expanded, toggleExpanded, waiting } = props;
  const status = browserStatus(browserPanel.session, !!control.leaseId, waiting, thread);
  return (
    <header className="browser-panel-heading">
      <div className="browser-heading-identity">
        <BrowserAgentPicker browserPanel={browserPanel} data={props.data} />
        <output
          aria-live="polite"
          title={status.detail}
          className={status.manual ? 'browser-owner-manual' : undefined}
        >
          <span className="browser-state-dot" aria-hidden="true" />
          <span className="truncate">{status.label}</span>
        </output>
      </div>
      <div className="browser-heading-actions">
        <BrowserControls browserPanel={browserPanel} thread={thread} control={control} />
        <BrowserTaskDetails {...props} />
        <BrowserMaintenance browserPanel={browserPanel} thread={thread} control={control} />
        {!narrow ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={expanded ? 'Restore split view' : 'Expand browser'}
            title={expanded ? 'Restore split view' : 'Expand browser'}
            onClick={toggleExpanded}
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </Button>
        ) : null}
        <Button
          size="icon-sm"
          variant="ghost"
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
