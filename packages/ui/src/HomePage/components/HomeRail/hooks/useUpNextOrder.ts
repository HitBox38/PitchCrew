import { queueMove, queueMoves } from '@/QueuePage/helpers.ts';
import { useQueueOrder } from '@/QueuePage/hooks/useQueueOrder.ts';
import type { QueueMoves } from '@/QueuePage/types.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { linePlaces } from '../helpers.ts';
import type { UpNextRow } from '../types.ts';

/**
 * Up next with Queue's own reorder: a move shows at once (each row says its new place) and is
 * saved as Queue saves it. Moves are computed over the whole ready line, never the rows shown,
 * so Move down on the third row places it fourth, not last. Reordering never interrupts work.
 */
export const useUpNextOrder = (rows: UpNextRow[], free: number) => {
  const action = useWorkspaceStore((state) => state.action);
  // Queue's own save, so Home never spells the endpoint.
  const order = useQueueOrder(rows, queueMove(action));
  const line = linePlaces(order.visible, free);
  const moves = (index: number): QueueMoves =>
    order.busy
      ? {}
      : queueMoves(order.visible, index, 0, (beforeId) => () => {
          const id = order.visible[index]?.id;
          if (id) void order.move(id, beforeId);
        });
  return { line, moves };
};
