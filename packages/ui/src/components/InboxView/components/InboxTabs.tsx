import type { InboxTabsProps } from '@/components/InboxView/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';

export function InboxTabs({ tab, setTab, data }: InboxTabsProps) {
  return (
    <fieldset className="inbox-tabs" aria-label="Approval view">
      <Button
        aria-pressed={tab === 'pending'}
        className={tab === 'pending' ? 'active' : ''}
        onClick={() => setTab('pending')}
      >
        Waiting{' '}
        <span>
          {data.approvals.filter((a) => ['pending', 'approved'].includes(a.status)).length +
            data.computerApprovals.filter((a) => ['pending', 'approved'].includes(a.status)).length}
        </span>
      </Button>
      <Button
        aria-pressed={tab === 'history'}
        className={tab === 'history' ? 'active' : ''}
        onClick={() => setTab('history')}
      >
        Decided
      </Button>
    </fieldset>
  );
}
