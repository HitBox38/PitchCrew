import { pipelineDrop } from '@/BoardPage/helpers.ts';
import { stages } from '@/board-stages.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { CardState } from '@pitchcrew/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/react';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

export function usePipelineDrag() {
  const { data, working, action } = useWorkspaceStore(
    useShallow((state) => ({ data: state.data, working: state.working, action: state.action })),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; from: CardState; to: CardState } | null>(
    null,
  );
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
  }
  async function endDrag(event: DragEndEvent) {
    setActiveId(null);
    const current = useWorkspaceStore.getState();
    const card = current.data?.cards.find((item) => item.id === event.operation.source?.id);
    const stage = stages.find((item) => item.id === event.operation.target?.id);
    if (event.canceled || !card || !stage || !current.data || current.working) return;
    const drop = pipelineDrop(card, stage, current.data);
    if (drop.kind === 'blocked') return;
    if (event.operation.activatorEvent?.type === 'keydown') focusId.current = card.id;
    if (drop.kind === 'move') setPending({ id: card.id, from: card.state, to: drop.state });
    try {
      await action(
        `/cards/${card.id}/${drop.kind === 'run' ? 'run' : 'move'}`,
        'POST',
        drop.kind === 'run' ? { roleId: drop.roleId } : { state: drop.state },
        drop.kind === 'run' ? 'Drafting started' : `Moved to ${stage.label}`,
      );
    } catch {
      // The workspace action shows the server's error; removing the preview restores the card.
    } finally {
      setPending(null);
    }
  }
  return { data, working, active, pending, startDrag, endDrag };
}
