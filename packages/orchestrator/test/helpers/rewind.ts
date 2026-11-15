import type { Board } from '@pitchcrew/board';

/**
 * Save a fixture entity in a status its lifecycle cannot reach from the saved one, such as a
 * finished run made active again. Product code never does this; tests refuse it through `record`.
 */
export const rewind = (board: Board, ...write: Parameters<Board['record']>) => {
  const mode = board.lifecycleMode;
  board.lifecycleMode = 'off';
  try {
    return board.record(...write);
  } finally {
    board.lifecycleMode = mode;
  }
};
