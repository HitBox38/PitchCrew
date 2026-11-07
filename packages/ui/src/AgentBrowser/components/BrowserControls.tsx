import { Bot, Hand } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { BrowserControl, AgentBrowserProps } from '../types.ts';
export const BrowserControls = ({
  browserPanel,
  control,
}: Pick<AgentBrowserProps, 'browserPanel' | 'thread'> & { control: BrowserControl }) => {
  const opened = browserPanel.session?.status === 'open';
  // The empty page owns its one Open browser action.
  if (!opened) return null;
  const label = control.leaseId
    ? 'Return to agent'
    : browserPanel.session?.manual
      ? 'Recover control'
      : 'Take control';
  const Icon = control.leaseId ? Bot : Hand;
  return (
    <div data-browser-controls>
      <Button
        size="sm"
        variant={control.leaseId ? 'secondary' : 'ghost'}
        className="browser-handoff"
        aria-label={label}
        title={
          label === 'Take control'
            ? 'Take control to browse. Your agent pauses while you use the page.'
            : label
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
