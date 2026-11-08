import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { ClayAutomaticSteps } from './ClayAutomaticSteps.tsx';
import { BrowserControls } from './BrowserControls.tsx';
import { browserTrayLine } from '../layout.ts';
import { useBrowserPresenceField } from '@/DesktopBrowserHost/presence.ts';
import { ClayPickingLine } from './ClayPickingLine.tsx';

/**
 * The reserved tray while nothing waits for a decision: one quiet line saying who has the page,
 * with the one control action that means something right now (Take control, Return to agent or
 * Recover control) at its end. The header never moves when that action changes.
 */
export const ClayApprovalIdle = ({
  control,
  nudged,
  ...props
}: Pick<AgentBrowserProps, 'browserPanel' | 'data' | 'thread' | 'action' | 'working'> & {
  control: BrowserControl;
  nudged: boolean;
}) => {
  const { browserPanel } = props;
  const name = browserPanel.role?.name ?? 'Your agent';
  const session = browserPanel.session;
  const picking = useBrowserPresenceField('picking');
  if (picking) return <ClayPickingLine picking={picking} />;
  if (!control.leaseId && !session?.manual && session?.mode === 'autonomous' && session.runId)
    return <ClayAutomaticSteps {...props} name={name} control={control} nudged={nudged} />;
  const line = browserTrayLine({
    name,
    held: !!control.leaseId,
    implicit: control.implicit,
    manual: !!session?.manual,
    working: !!session?.runId,
  });
  return (
    <p className="clay-tray-line">
      <span
        className="clay-bead"
        data-size="sm"
        data-tone={line.tone ?? undefined}
        data-empty={line.tone ? undefined : ''}
        aria-hidden="true"
      />
      <span className="truncate">{line.text}</span>
      <BrowserControls
        browserPanel={browserPanel}
        thread={props.thread}
        control={control}
        nudged={nudged}
      />
    </p>
  );
};
