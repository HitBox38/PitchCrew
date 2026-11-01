import { Bot, Hand } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { ClayAutomaticSteps } from './ClayAutomaticSteps.tsx';

/**
 * The reserved approval tray while nothing waits for a decision: your private
 * control with Return to agent, a lapsed lease to recover, automatic preparation or idle.
 */
export const ClayApprovalIdle = ({
  control,
  ...props
}: Pick<AgentBrowserProps, 'browserPanel' | 'data' | 'thread' | 'action' | 'working'> & {
  control: BrowserControl;
}) => {
  const { browserPanel } = props;
  const name = browserPanel.role?.name ?? 'Your agent';
  const session = browserPanel.session;
  const held = !!control.leaseId;
  if (held || session?.manual)
    return (
      <section className="clay-tray-state" aria-label="Browser control">
        <div className="clay-tray-copy">
          <p className="clay-tray-title">
            <StatusBead status="waiting" />
            <strong>{held ? `${name} is waiting` : 'Control needs recovering'}</strong>
          </p>
          <p>
            {held
              ? `What you type stays private, and passwords are masked in anything ${name} reads later. Return control when you’re done.`
              : `${name} stays paused and this page stays private until you recover control and return it.`}
          </p>
        </div>
        <Button
          size="sm"
          disabled={control.working}
          onClick={() => void (held ? control.release() : control.take())}
        >
          {held ? <Bot size={15} /> : <Hand size={15} />}
          {held ? 'Return to agent' : 'Recover control'}
        </Button>
      </section>
    );
  if (session?.mode === 'autonomous') return <ClayAutomaticSteps {...props} name={name} />;
  return (
    <div className="clay-tray-state">
      <div className="clay-tray-copy">
        <p className="clay-tray-title">
          <StatusBead status="queued" />
          <span>{name} · this run</span>
        </p>
        <p>
          Nothing to approve yet. Clicks, uploads and the final submit will show up here, without
          moving the page.
        </p>
      </div>
    </div>
  );
};
