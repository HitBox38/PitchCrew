import { useEffect, useRef, useState } from 'react';
import type { CardState } from '@pitchcrew/core';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { closedStates } from '@/board-stages.ts';
import { canDragJob, statusDrop } from '../helpers.ts';
import { saveJobStatus, removeJob } from '../api.ts';
import { jobFocusTarget, restoreJobFocus } from '../focus.ts';
import type { JobReveal } from './useJobPage.ts';

export const useBoardJobMutations = () => {
  const moveJob = async (id: string, state: CardState, follow = false) => {
    const current = useWorkspaceStore.getState();
    const card = current.data?.cards.find((card) => card.id === id);
    if (
      !card ||
      !current.data ||
      current.working ||
      statusDrop(card, state, current.data).kind === 'blocked'
    )
      return;
    focus.current = jobFocusTarget(id);
    setPending({ id, from: card.state, to: state });
    try {
      await saveJobStatus(action, id, state);
      if (follow) current.setShowClosed(closedStates.includes(state));
    } catch {
      // The workspace action reports errors; clearing the preview restores the original card.
    } finally {
      setReveal({ id });
      setPending(null);
    }
  };

  const requestDelete = (id: string) => {
    focus.current = jobFocusTarget(id);
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    const current = useWorkspaceStore.getState();
    const card = current.data?.cards.find((card) => card.id === deletingId);
    if (!card || !current.data || current.working || !canDragJob(card, current.data)) return;
    try {
      await removeJob(action, card.id);
      setDeletingId(null);
    } catch {
      // Keep the confirmation open and let the workspace action show the error.
    }
  };

  const { data, working, action } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
      working: state.working,
      action: state.action,
    })),
  );
  const [pending, setPending] = useState<{ id: string; from: CardState; to: CardState } | null>(
    null,
  );
  const [reveal, setReveal] = useState<JobReveal>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const focus = useRef<ReturnType<typeof jobFocusTarget> | null>(null);
  const deletingCard = data?.cards.find((card) => card.id === deletingId) ?? null;
  useEffect(() => {
    if (working || pending || deletingCard || !focus.current) return;
    restoreJobFocus(
      focus.current,
      data?.cards.find((card) => card.id === focus.current?.id)?.state,
    );
    focus.current = null;
  }, [working, pending, deletingCard, data]);

  return {
    data,
    working,
    pending,
    reveal,
    moveJob,
    requestDelete,
    deletingCard,
    confirmDelete,
    closeDelete: () => setDeletingId(null),
  };
};
