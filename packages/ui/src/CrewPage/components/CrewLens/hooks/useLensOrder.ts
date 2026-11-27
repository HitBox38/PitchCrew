import { useState } from 'react';
import { lensOrder, type LensRow } from '@/lib/crew-lens.ts';
import { keptOrder } from '../helpers.ts';

/**
 * Busy rows in the order fixed when Crew opened, most urgent first, so no row moves under the
 * pointer as its asks are decided elsewhere. An agent that gets busy later joins after them, in
 * roster order. The order is computed when the lens mounts.
 */
export const useLensOrder = (rows: readonly LensRow[]) => {
  const [first] = useState(() => lensOrder(rows));
  return keptOrder(first, rows);
};
