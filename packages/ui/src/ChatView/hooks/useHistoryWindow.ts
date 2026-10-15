import { useState } from 'react';
import type { TranscriptItem } from '../../ChatTurn/helpers.ts';
import { historyWindow } from '../history.ts';

export function useHistoryWindow(items: TranscriptItem[]) {
  const [anchor, navigate] = useState<string | null>(null);
  return { ...historyWindow(items, anchor), anchor, navigate };
}
