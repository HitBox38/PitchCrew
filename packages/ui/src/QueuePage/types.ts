/** Keyboard and menu equivalents of dragging one item; absent when that move is impossible. */
export type QueueMoves = {
  up?: () => void;
  down?: () => void;
  makeNext?: () => void;
};
