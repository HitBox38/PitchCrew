import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { ClayAutomaticSteps } from './ClayAutomaticSteps.tsx';

/**
 * The reserved tray while nothing waits for a decision: one quiet line. The header owns the
 * control action (Return to agent, Recover control), so the tray never repeats it.
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
  if (!held && !session?.manual && session?.mode === 'autonomous')
    return <ClayAutomaticSteps {...props} name={name} />;
  const [tone, text] = held
    ? (['primary', `You’re using the page. ${name} waits until you return it.`] as const)
    : session?.manual
      ? (['ochre', `${name} is paused until you recover control.`] as const)
      : (['plum', `${name} is working. Its clicks, typing and submissions appear here.`] as const);
  return (
    <p className="clay-tray-line" aria-label="Browser approvals">
      <span className="clay-bead" data-size="sm" data-tone={tone} aria-hidden="true" />
      <span className="truncate">{text}</span>
    </p>
  );
};
