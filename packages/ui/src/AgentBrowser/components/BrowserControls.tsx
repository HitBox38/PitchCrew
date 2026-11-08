import { Bot, Hand } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { BrowserControl, AgentBrowserProps } from '../types.ts';

/**
 * The header's one control action, shown only when it means something: Take control while the
 * agent works, Return to agent after an explicit takeover, Recover control when it lapsed. Idle
 * pages are already usable and implicit browsing hands back on its own, so neither shows one.
 */
export const BrowserControls = ({
  browserPanel,
  control,
}: Pick<AgentBrowserProps, 'browserPanel' | 'thread'> & { control: BrowserControl }) => {
  const session = browserPanel.session;
  if (session?.status !== 'open') return null;
  const name = browserPanel.role?.name ?? 'the agent';
  const label = control.leaseId
    ? control.implicit
      ? null
      : 'Return to agent'
    : session.manual
      ? 'Recover control'
      : session.runId
        ? 'Take control'
        : null;
  if (!label) return null;
  const Icon = control.leaseId ? Bot : Hand;
  return (
    <div data-browser-controls>
      <Button
        size="sm"
        variant={label === 'Take control' ? 'outline' : 'secondary'}
        className="browser-handoff"
        aria-label={label}
        title={
          label === 'Take control'
            ? `Use the page yourself. ${name} pauses until you return it.`
            : label === 'Return to agent'
              ? `Give the page back to ${name}.`
              : `Take control back, then return it to ${name}.`
        }
        disabled={control.working}
        onClick={() => {
          if (control.leaseId) void control.release();
          else void control.take();
        }}
      >
        <Icon size={15} />
        <span className="browser-control-label">{label}</span>
      </Button>
    </div>
  );
};
