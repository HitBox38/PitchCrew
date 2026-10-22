import type { InboxTabsProps } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { approvalRequests } from '../helpers.ts';
export const InboxTabs = ({ tab, setTab, data }: InboxTabsProps) => (
  <fieldset className="inbox-tabs" aria-label="Inbox view">
    <Button
      aria-pressed={tab === 'pending'}
      className={tab === 'pending' ? 'active' : ''}
      onClick={() => setTab('pending')}
    >
      Needs action <span>{approvalRequests(data, 'pending').length}</span>
    </Button>
    <Button
      aria-pressed={tab === 'history'}
      className={tab === 'history' ? 'active' : ''}
      onClick={() => setTab('history')}
    >
      History
    </Button>
  </fieldset>
);
