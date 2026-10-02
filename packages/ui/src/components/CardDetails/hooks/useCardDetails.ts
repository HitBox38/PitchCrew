import type { CardDetailsProps } from '@/components/CardDetails/types.ts';
import type { Packet } from '@pitchcrew/core';
import { useState } from 'react';

export function useCardDetails({
  card,
  data,
  action,
  working,
  onClose,
  onInbox,
}: CardDetailsProps) {
  const [tab, setTab] = useState<'overview' | 'packet' | 'history'>('overview');
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
  const runRole =
    card.state === 'lead'
      ? 'scout'
      : ['shortlisted', 'changes_requested'].includes(card.state)
        ? 'writer'
        : card.state === 'in_review'
          ? 'reviewer'
          : null;
  return {
    card,
    data,
    working,
    onClose,
    onInbox,
    tab,
    setTab,
    document,
    setDocument,
    act,
    run,
    failed,
    exported,
    runRole,
  };
}
