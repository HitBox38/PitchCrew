import { useEffect, useRef } from 'react';
import type { BulkReport } from '../types.ts';

/**
 * Focus for a new batch result: when the selection bar left with the batch (focus fell to the
 * page), it lands on the result's summary so the outcome is read. Returns the summary's ref.
 */
export const useResultFocus = (report: BulkReport) => {
  const summary = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) summary.current?.focus({ preventScroll: true });
  }, [report]);
  return summary;
};
