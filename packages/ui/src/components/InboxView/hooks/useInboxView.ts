import type { InboxViewProps } from '@/components/InboxView/types.ts';
import { useState } from 'react';

export function useInboxView({ data, action, working, onOpen }: InboxViewProps) {
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const approvals = data.approvals.filter((a) =>
    tab === 'pending'
      ? ['pending', 'approved'].includes(a.status)
      : ['rejected', 'consumed'].includes(a.status),
  );
  const computerApprovals = data.computerApprovals.filter((a) =>
    tab === 'pending'
      ? ['pending', 'approved'].includes(a.status)
      : !['pending', 'approved'].includes(a.status),
  );
  const act = (path: string, body?: unknown, success?: string) => {
    void action(path, 'POST', body, success).catch(() => {});
  };
  return { data, action, working, onOpen, tab, setTab, approvals, computerApprovals, act };
}
