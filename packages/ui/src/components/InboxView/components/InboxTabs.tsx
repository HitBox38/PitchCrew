import type { InboxTabsProps } from '@/components/InboxView/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';

export function InboxTabs({ tab, setTab, data }: InboxTabsProps) {
  return (
    <div className="inbox-tabs">
      <Button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>
        Waiting{' '}
        <span>
          {data.approvals.filter((a) => ['pending', 'approved'].includes(a.status)).length +
            data.computerApprovals.filter((a) => ['pending', 'approved'].includes(a.status)).length}
        </span>
      </Button>
      <Button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
        Decided
      </Button>
    </div>
  );
}
