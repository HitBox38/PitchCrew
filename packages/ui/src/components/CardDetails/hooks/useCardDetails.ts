import type { CardDetailsProps } from '@/components/CardDetails/types.ts';
import type { Packet } from '@pitchcrew/core';
import { workflowSeat } from '@pitchcrew/core/states';
import { useState } from 'react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';

export function useCardDetails({
  card,
  data,
  action,
  working,
  onClose,
  onInbox,
}: CardDetailsProps) {
  const [tab, setTab] = useState<'overview' | 'packet' | 'reviews' | 'history'>('overview');
  const [briefDirty, setBriefDirty] = useState(false);
  const guard = useUnsavedChanges(briefDirty);
  const [document, setDocument] = useState<keyof Omit<Packet, 'claims'>>('resume');
  const act = (path: string, body?: unknown, success?: string) => {
    void action(path, 'POST', body, success).catch(() => {});
  };
  const run = data.runs.find((r) => r.cardId === card.id && r.status === 'running');
  const failed = data.runs.find((r) => r.cardId === card.id && r.status === 'failed');
  const exported = data.approvals.some(
    (a) =>
      a.cardId === card.id &&
      a.status === 'consumed' &&
      a.exportDirectory &&
      JSON.stringify(a.packet) === JSON.stringify(card.packet),
  );
  const seat =
    card.state === 'lead'
      ? 'scout'
      : ['shortlisted', 'changes_requested'].includes(card.state)
        ? 'writer'
        : card.state === 'in_review'
          ? 'reviewer'
          : null;
  const runRole =
    data.roles.find((role) => role.enabled && !role.retiredAt && workflowSeat(role) === seat)?.id ??
    null;
  return {
    card,
    data,
    working,
    onClose: () => guard.requestLeave(onClose),
    guard,
    setBriefDirty,
    onInbox,
    tab,
    setTab: (next: typeof tab) =>
      guard.requestLeave(() => {
        setBriefDirty(false);
        setTab(next);
      }),
    document,
    setDocument,
    act,
    run,
    failed,
    exported,
    runRole,
  };
}
