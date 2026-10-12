import { Bot, Globe, Hand } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { BrowserControl, AgentBrowserProps } from '../types.ts';
export function BrowserControls({
  browserPanel,
  control,
}: Pick<AgentBrowserProps, 'browserPanel' | 'thread'> & { control: BrowserControl }) {
  const opened = browserPanel.session?.status === 'open';
  const label = !opened
    ? 'Open browser'
    : control.leaseId
      ? 'Return to agent'
      : browserPanel.session?.manual
        ? 'Recover control'
        : 'Take control';
  const Icon = !opened ? Globe : control.leaseId ? Bot : Hand;
  return (
    <div data-browser-controls>
      <Button
        size="sm"
        variant={control.leaseId ? 'secondary' : 'ghost'}
        className="browser-handoff"
        aria-label={label}
        title={label}
        disabled={control.working}
        onClick={() => {
          if (!opened) void control.open();
          else if (control.leaseId) void control.release();
          else void control.take();
        }}
      >
        <Icon size={15} />
        <span className="browser-control-label">{label}</span>
      </Button>
    </div>
  );
}
