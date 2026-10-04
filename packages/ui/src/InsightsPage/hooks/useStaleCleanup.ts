import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { StaleSubmission } from '@pitchcrew/core';
import { staleDefaults, staleBatchLimit } from '@pitchcrew/core/insights';
import { useState } from 'react';
import { previewStaleSubmissions } from '../api.ts';
import { staleSelection } from '../helpers.ts';

export function useStaleCleanup() {
  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  const [days, setDays] = useState(String(staleDefaults.days));
  const [preview, setPreview] = useState<{ days: number; cards: StaleSubmission[] } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const parsed = Number(days);
  const validDays =
    Number.isInteger(parsed) && parsed >= staleDefaults.minimum && parsed <= staleDefaults.maximum;
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await previewStaleSubmissions(parsed);
      setPreview(result);
      setSelected(staleSelection(result.cards));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not check submissions.');
    } finally {
      setLoading(false);
    }
  };
  const toggle = (id: string, checked: boolean) =>
    setSelected((current) =>
      checked
        ? current.includes(id) || current.length >= staleBatchLimit
          ? current
          : [...current, id]
        : current.filter((other) => other !== id),
    );
  const apply = async () => {
    if (!preview) return;
    const cards = preview.cards
      .filter((card) => selected.includes(card.id))
      .map(({ id, updatedAt }) => ({ id, updatedAt }));
    try {
      await action(
        '/insights/stale',
        'POST',
        { days: preview.days, note, cards },
        `Marked ${cards.length} as no response`,
      );
      setPreview(null);
      setSelected([]);
      setNote('');
    } catch {
      /* The store shows the error; preview again if something changed. */
    }
    setConfirming(false);
  };
  return {
    days,
    setDays,
    validDays,
    preview,
    selected,
    toggle,
    note,
    setNote,
    error,
    loading,
    working,
    confirming,
    setConfirming,
    load,
    apply,
  };
}
export type StaleCleanupModel = ReturnType<typeof useStaleCleanup>;
