import type { TranscriptItem } from '../ChatTurn/helpers.ts';
import { transcriptWindow } from '@pitchcrew/core/transcript-order';

/** Anchor older pages by identity so incoming replies never move the reader's page. */
export const historyWindow = (items: TranscriptItem[], anchor: string | null) => {
  return transcriptWindow(
    items,
    anchor,
    HISTORY_PAGE_SIZE,
    (previous, current) =>
      previous.kind === 'turn' &&
      current.kind === 'message' &&
      previous.run.id === current.message.runId &&
      previous.run.roleId === current.message.from,
  );
};

export const HISTORY_PAGE_SIZE = 50;
