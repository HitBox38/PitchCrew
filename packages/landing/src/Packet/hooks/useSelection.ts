'use client';

import { useState } from 'react';
import { claims, initialClaim } from '../constants';

export type Decision = 'waiting' | 'approved' | 'changes';

/** Radio-backed selection with a hover preview on fine pointers, plus the sheet's decision. */
export const useSelection = () => {
  const [selected, select] = useState(initialClaim);
  const [preview, setPreview] = useState<string>();
  const [decision, decide] = useState<Decision>('waiting');
  const shown = claims.find((claim) => claim.id === (preview ?? selected)) ?? claims[0]!;
  const enter = (id: string, event: React.PointerEvent) => {
    if (event.pointerType === 'mouse') setPreview(id);
  };
  const leave = () => setPreview(undefined);
  return { selected, select, shown, enter, leave, decision, decide };
};
