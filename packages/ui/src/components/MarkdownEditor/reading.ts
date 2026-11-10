import { ensureSyntaxTree, syntaxTree, syntaxTreeAvailable } from '@codemirror/language';
import type { EditorState, Text } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/**
 * A reading place: the nth top-level block and how far into it (px) the reader has scrolled
 * (negative in the space above it), and, from the editor, the source line at the top of the view.
 */
export type Spot = { block: number; offset: number; line?: number };

/** What Write and Preview share to keep the reader's place when switching or side by side. */
export interface ReadingBridge {
  view: EditorView | null;
  /** Where the reader scrolled Preview to; null when they have not since Write was shown. */
  previewSpot: Spot | null;
}

/** The source editor registers itself with the shell (null when it goes away). */
export const attachView = (bridge: ReadingBridge | undefined, view: EditorView | null) => {
  if (bridge) bridge.view = view;
};

/** Top-level source blocks that render nothing in the preview. */
const silent = new Set(['LinkReference', 'CommentBlock', 'ProcessingInstructionBlock']);
type Block = { from: number; to: number };
let cache: { doc: Text; blocks: Block[] | null } | null = null;

/**
 * The note's top-level blocks (heading, paragraph, list, quote, code, table, rule), each of which
 * the preview renders as one element, in order. Null when that correspondence cannot be trusted:
 * the parse is not ready yet (never cached, so a later call can succeed), or the note has raw
 * HTML blocks, which the preview may drop or split into several elements.
 */
export const sourceBlocks = (state: EditorState) => {
  if (cache?.doc === state.doc) return cache.blocks;
  const length = state.doc.length;
  // Never force a long parse from the scroll path: use the tree once the editor has it.
  const tree = syntaxTreeAvailable(state, length)
    ? syntaxTree(state)
    : ensureSyntaxTree(state, length, 20);
  if (!tree) return null;
  let blocks: Block[] | null = [];
  for (let node = tree.topNode.firstChild; node; node = node.nextSibling) {
    if (node.name === 'HTMLBlock') {
      blocks = null;
      break;
    }
    if (!silent.has(node.name)) blocks.push({ from: node.from, to: node.to });
  }
  cache = { doc: state.doc, blocks };
  return blocks;
};

const padding = (element: Element) => parseFloat(getComputedStyle(element).paddingTop) || 0;

/** Where the editor's reader is. Lines in view are measured, so this is exact. */
export const editorSpot = (view: EditorView): Spot | null => {
  const blocks = sourceBlocks(view.state);
  if (!blocks?.length) return null;
  const y = view.scrollDOM.scrollTop - padding(view.contentDOM);
  const line = view.lineBlockAtHeight(Math.max(0, y));
  let block = blocks.findIndex((item, index) => (blocks[index + 1]?.from ?? Infinity) > line.from);
  if (block < 0) block = blocks.length - 1;
  // In the blank lines after a block, the place belongs to the next block (a negative offset).
  if (line.from > blocks[block].to && block + 1 < blocks.length) block++;
  // The line the reader sees first: past blank lines at the very top edge.
  const { doc } = view.state;
  let first = doc.lineAt(line.from);
  while (!first.text.trim() && first.number < doc.lines) first = doc.line(first.number + 1);
  return { block, offset: y - view.lineBlockAt(blocks[block].from).top, line: first.number };
};

/** The source line where a block starts (1-based). */
export const blockLine = (view: EditorView, block: number) => {
  const from = sourceBlocks(view.state)?.[block]?.from;
  return from === undefined ? undefined : view.state.doc.lineAt(from).number;
};

/** Where a place is in the editor's scroll offsets (its block's top plus the offset). */
const editorTop = (view: EditorView, from: number, offset: number) =>
  padding(view.contentDOM) + view.lineBlockAt(from).top + offset;

/**
 * Scrolls the editor to a place: its block first (so the editor measures that region instead of
 * estimating it), then, once laid out, to the exact offset within it, unless the reader or a
 * newer navigation has moved the editor meanwhile.
 */
export const revealSpot = (view: EditorView, spot: Spot, visible: () => boolean) => {
  const from = sourceBlocks(view.state)?.[spot.block]?.from;
  if (from === undefined) return false;
  view.dispatch({ effects: EditorView.scrollIntoView(from, { y: 'start', yMargin: 0 }) });
  const { doc, selection } = view.state;
  let landed = -1;
  requestAnimationFrame(() => {
    landed = view.scrollDOM.scrollTop;
    requestAnimationFrame(() => {
      const moved = Math.abs(view.scrollDOM.scrollTop - landed) > 2;
      if (!visible() || moved || view.state.doc !== doc || !view.state.selection.eq(selection))
        return;
      view.scrollDOM.scrollTop = editorTop(view, from, spot.offset);
    });
  });
  return true;
};

/** Split: moves the editor with the preview the reader is scrolling, without a transaction. */
export const followSpot = (view: EditorView, spot: Spot) => {
  const from = sourceBlocks(view.state)?.[spot.block]?.from;
  if (from !== undefined) view.scrollDOM.scrollTop = editorTop(view, from, spot.offset);
};

const renderedBlocks = (preview: HTMLElement) =>
  [...(preview.querySelector('.md-rendered')?.children ?? [])] as HTMLElement[];
const topIn = (preview: HTMLElement, element: HTMLElement) =>
  element.getBoundingClientRect().top - preview.getBoundingClientRect().top + preview.scrollTop;

/** The preview shows exactly the editor's blocks, so places can map between them. */
const agree = (preview: HTMLElement, view: EditorView | null) => {
  const expected = view ? sourceBlocks(view.state)?.length : undefined;
  return expected !== undefined && expected === renderedBlocks(preview).length;
};

/** Where the preview's reader is; null when its blocks do not match the editor's. */
export const previewSpot = (preview: HTMLElement, view: EditorView | null): Spot | null => {
  const blocks = renderedBlocks(preview);
  if (!blocks.length || !agree(preview, view)) return null;
  const y = preview.scrollTop;
  let block = blocks.findIndex((element) => topIn(preview, element) + element.offsetHeight > y);
  if (block < 0) block = blocks.length - 1;
  return { block, offset: y - topIn(preview, blocks[block]) };
};

/**
 * Scrolls the preview to a place from the editor. False when the two disagree on the blocks
 * (the rendered note is not ready, or odd Markdown), so the caller can fall back.
 */
export const placePreview = (preview: HTMLElement, spot: Spot, view: EditorView | null) => {
  const blocks = renderedBlocks(preview);
  const element = blocks[spot.block];
  if (!element || !agree(preview, view)) return false;
  // A negative offset is the space above the block: the gap after the block before it, or the
  // note's top padding for the first block.
  const top = topIn(preview, element);
  const previous = blocks[spot.block - 1];
  const above = previous ? top - topIn(preview, previous) - previous.offsetHeight : top;
  preview.scrollTop = top + Math.min(Math.max(-above, spot.offset), element.offsetHeight);
  return true;
};
