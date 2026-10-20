import { useState } from 'react';
import type { TranscriptItem } from '../../ChatTurn/helpers.ts';
import { historyWindow } from '../history.ts';

export function useHistoryWindow(items: TranscriptItem[], focusRunId?: string) {
  const [anchor, navigate] = useState<string | null>(focusRunId ? `turn-${focusRunId}` : null);
  return { ...historyWindow(items, anchor), anchor, navigate };
}
