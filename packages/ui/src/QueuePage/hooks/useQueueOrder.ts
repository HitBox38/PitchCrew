import { useState } from 'react';

export const useQueueOrder = <T extends { id: string }>(
  items: T[],
  commit: (id: string, beforeId: string | null) => Promise<unknown>,
) => {
  const [order, setOrder] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const visible = order
    ? [
        ...order.flatMap((id) => items.filter((i) => i.id === id)),
        ...items.filter((i) => !order.includes(i.id)),
      ]
    : items;
  const move = async (id: string, beforeId: string | null) => {
    if (busy || id === beforeId) return;
    const next = visible.filter((i) => i.id !== id);
    const item = visible.find((i) => i.id === id);
    if (!item) return;
    const index = beforeId ? next.findIndex((i) => i.id === beforeId) : next.length;
    if (index < 0) return;
    next.splice(index, 0, item);
    setOrder(next.map((i) => i.id));
    setBusy(true);
    try {
      await commit(id, beforeId);
    } catch {
      /* The workspace action displays the error; layout animates back. */
    } finally {
      setOrder(null);
      setBusy(false);
    }
  };
  return { visible, busy, move };
};
