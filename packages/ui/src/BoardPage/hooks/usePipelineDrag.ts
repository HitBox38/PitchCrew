import type { JobReveal } from './useJobPage.ts';
import { pipelineDrop, statusDrop } from '@/BoardPage/helpers.ts';
import { keyboardDestination } from '@/BoardPage/keyboard-sensor.ts';
import { closedStates, dropStages } from '@/board-stages.ts';
import { stateLabels } from '@/lib/labels.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { CardState } from '@pitchcrew/core';
import { states } from '@pitchcrew/core/states';
import type { DragEndEvent, DragStartEvent, DragMoveEvent } from '@dnd-kit/react';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

export function usePipelineDrag() {
  const { data, working, action } = useWorkspaceStore(
    useShallow((state) => ({ data: state.data, working: state.working, action: state.action })),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selection, setSelection] = useState<CardState | null | undefined>();
  const [pending, setPending] = useState<{ id: string; from: CardState; to: CardState } | null>(
    null,
  );
  const [reveal, setReveal] = useState<JobReveal>(null);
  const focusId = useRef<string | null>(null);
  useEffect(() => {
    if (working || pending || !focusId.current) return;
    const id = focusId.current;
    const state = data?.cards.find((card) => card.id === id)?.state;
    const node = document.querySelector(`#board-job-${CSS.escape(id)}[data-card-state="${state}"]`);
    const handle = node?.querySelector<HTMLButtonElement>('.job-drag-handle:not(:disabled)');
    const button = node?.querySelector<HTMLButtonElement>('.job-card');
    (handle ?? button)?.focus({ preventScroll: true });
    focusId.current = null;
  }, [working, pending, data]);
  const active = data?.cards.find((card) => card.id === activeId) ?? null;
  function startDrag(event: DragStartEvent) {
    setActiveId(String(event.operation.source?.id ?? ''));
    setSelection(event.operation.activatorEvent?.type === 'keydown' ? null : undefined);
  }
  function moveDrag(event: DragMoveEvent) {
    const state = keyboardDestination(event.nativeEvent);
    if (state) setSelection(state);
  }
  async function endDrag(event: DragEndEvent) {
    const sourceId = event.operation.source?.id;
    const destination = keyboardDestination(event.nativeEvent);
    const targetId = destination
      ? `status-${destination}`
      : String(event.operation.target?.id ?? '');
    const keyboard = event.operation.activatorEvent?.type === 'keydown';
    setActiveId(null);
    setSelection(undefined);
    const current = useWorkspaceStore.getState();
    const card = current.data?.cards.find((item) => item.id === sourceId);
    const state = states.find((item) => targetId === `status-${item}`);
    const stage = dropStages.find((item) => item.id === targetId);
    if (event.canceled || !card || (!state && !stage) || !current.data || current.working) return;
    const drop = state
      ? statusDrop(card, state, current.data)
      : pipelineDrop(card, stage!, current.data);
    if (drop.kind === 'blocked') return;
    if (keyboard) focusId.current = card.id;
    setPending({ id: card.id, from: card.state, to: drop.state });
    try {
      await action(
        `/cards/${card.id}/status`,
        'POST',
        { state: drop.state },
        `Moved to ${stateLabels[drop.state]}`,
      );
      current.setShowClosed(closedStates.includes(drop.state));
    } catch {
      // The workspace action shows the server's error; removing the preview restores the card.
    } finally {
      setReveal({ id: card.id });
      setPending(null);
    }
  }
  return { data, working, active, pending, reveal, selection, startDrag, moveDrag, endDrag };
}
