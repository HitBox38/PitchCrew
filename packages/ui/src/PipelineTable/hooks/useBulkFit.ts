import { useRef, useState } from 'react';
import { attentionItems } from '@/lib/attention.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { sendFits } from '../api.ts';
import { fitOutcomes, planFits, settledIds } from '../bulk.ts';
import type { BulkReport } from '../types.ts';
import type { TableModel } from './usePipelineTable.ts';

/**
 * Bulk Evaluate fit: preflight from the snapshot, one queued board action per eligible job sent
 * one at a time, then one reload and a per-job report read from the refreshed snapshot. Queued and
 * already queued jobs leave the selection; jobs not sent or unconfirmed stay selected. A workspace
 * reason stops the batch before anything is sent. It records no analytics event of its own.
 */
export const useBulkFit = (model: Pick<TableModel, 'selected' | 'rows' | 'deselect'>) => {
  const reload = useWorkspaceStore((state) => state.reload);
  const running = useRef(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<BulkReport | null>(null);
  const evaluate = async () => {
    const data = useWorkspaceStore.getState().data;
    if (!data || running.current) return;
    const plan = planFits(data, attentionItems(data), model.selected);
    if (plan.blocker !== undefined) {
      setReport({ blocker: plan.blocker });
      return;
    }
    running.current = true;
    const order = model.rows.map((row) => row.card.id);
    const total = plan.send.length;
    setReport(null);
    setProgress({ done: 0, total });
    try {
      const sent = await sendFits(
        plan.send,
        () => useWorkspaceStore.getState().data,
        (done) => setProgress({ done, total }),
      );
      // The places, and what an unanswered call did, come from the refreshed snapshot. A failed
      // reload keeps the last one, so such a call stays unconfirmed unless that shows its request.
      if (total) await reload().catch(() => {});
      const fresh = useWorkspaceStore.getState().data ?? data;
      const outcomes = fitOutcomes(fresh, attentionItems(fresh), plan, sent, order);
      setReport({ outcomes });
      model.deselect(settledIds(outcomes));
    } finally {
      running.current = false;
      setProgress(null);
    }
  };
  return {
    progress,
    report,
    evaluate: () => void evaluate(),
    dismiss: () => setReport(null),
  };
};

export type BulkModel = ReturnType<typeof useBulkFit>;
