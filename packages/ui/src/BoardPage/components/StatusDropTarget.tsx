import { statusDrop } from '@/BoardPage/helpers.ts';
import { stateLabels } from '@/lib/labels.ts';
import { useDroppable } from '@dnd-kit/react';
import { pointerIntersection } from '@dnd-kit/collision';
import type { Card, CardState, Snapshot } from '@pitchcrew/core';

export function StatusDropTarget({
  state,
  active,
  data,
  working,
  selection,
}: {
  state: CardState;
  active: Card;
  data: Snapshot;
  working: boolean;
  selection?: CardState | null;
}) {
  const drop = statusDrop(active, state, data);
  const allowed = drop.kind === 'move' && !working;
  const { ref, isDropTarget } = useDroppable({
    id: `status-${state}`,
    disabled: !allowed,
    collisionPriority: 3,
    collisionDetector: pointerIntersection,
    data: { state, label: stateLabels[state], action: drop.label },
  });
  return (
    <div
      ref={ref}
      className="status-drop-target px-2 py-2 text-xs"
      data-status={state}
      data-drop-allowed={allowed || undefined}
      data-drop-target={(selection === undefined ? isDropTarget : selection === state) || undefined}
      aria-disabled={!allowed}
    >
      {stateLabels[state]}
    </div>
  );
}
