import { pipelineDrop, statusDrop } from '@/BoardPage/helpers.ts';
import { dropStages } from '@/board-stages.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { states } from '@pitchcrew/core/states';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/react';
import { useState } from 'react';
import type { useBoardJobMutations } from './useBoardJobMutations.ts';

export function usePipelineDrag(mutations: ReturnType<typeof useBoardJobMutations>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = mutations.data?.cards.find((card) => card.id === activeId) ?? null;
  function startDrag(event: DragStartEvent) {
    setActiveId(String(event.operation.source?.id ?? ''));
  }
  async function endDrag(event: DragEndEvent) {
    const sourceId = event.operation.source?.id;
    const targetId = String(event.operation.target?.id ?? '');
    setActiveId(null);
    const current = useWorkspaceStore.getState();
    const card = current.data?.cards.find((item) => item.id === sourceId);
    const state = states.find((item) => targetId === `status-${item}`);
    const stage = dropStages.find((item) => item.id === targetId);
    if (event.canceled || !card || (!state && !stage) || !current.data || current.working) return;
    const drop = state
      ? statusDrop(card, state, current.data)
      : pipelineDrop(card, stage!, current.data);
    if (drop.kind === 'move') await mutations.moveJob(card.id, drop.state, true);
  }
  return { ...mutations, active, startDrag, endDrag };
}
