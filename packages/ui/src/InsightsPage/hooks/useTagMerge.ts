import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { Card } from '@pitchcrew/core';
import { useState } from 'react';
import { cardsWithTag } from '../helpers.ts';

export function useTagMerge(cards: Card[]) {
  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [confirming, setConfirming] = useState(false);
  const affected = from ? cardsWithTag(cards, from) : [];
  const target = to.trim();
  const ready =
    !working && affected.length > 0 && target.length > 0 && target.length <= 40 && target !== from;
  const merge = async () => {
    try {
      await action('/tags/merge', 'POST', { from, to: target }, `Merged ${from} into ${target}`);
      setFrom('');
      setTo('');
    } catch {
      /* The store shows the error. */
    }
    setConfirming(false);
  };
  return {
    from,
    setFrom,
    to,
    setTo,
    target,
    affected,
    ready,
    working,
    confirming,
    setConfirming,
    merge,
  };
}
