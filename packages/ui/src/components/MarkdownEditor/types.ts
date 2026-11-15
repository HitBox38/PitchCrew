import type { ReadingBridge } from './reading.ts';
import type { RefObject } from 'react';

/** Write shows the source, Preview the rendered note, and Split both side by side. */
export type MarkdownMode = 'write' | 'split' | 'preview';

export type MarkdownFormat =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'link'
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'number'
  | 'task'
  | 'quote'
  | 'codeblock'
  | 'rule'
  | 'table';

export interface MarkdownCursor {
  line: number;
  column: number;
  /** Characters selected across every selection range. */
  selected: number;
  /** Formats around the caret, for the toolbar's pressed state and the text style menu. */
  formats: MarkdownFormat[];
}

/** Imperative editor actions for toolbars, outlines and citations outside the lazy surface. */
export interface MarkdownEditorHandle {
  format: (kind: MarkdownFormat) => void;
  /** Focuses the editor; `end` also puts the caret after the last character. */
  focus: (at?: 'end') => void;
  /** Selects and centers the first exact occurrence; false when the draft no longer has it. */
  revealText: (text: string, options?: { ignoreCase?: boolean }) => boolean;
  /** Moves the caret to the start of a 1-based line and scrolls it near the top. */
  revealLine: (line: number) => void;
  openSearch: () => void;
}

export interface MarkdownEditorProps {
  id: string;
  label: string;
  /** Identity of the open document: undo history, selection and scroll are kept per key. */
  documentKey?: string;
  content: string;
  onChange: (content: string) => void;
  maxLength: number;
  mode: MarkdownMode;
  placeholder?: string;
  disabled?: boolean;
  /** Show every Markdown mark instead of hiding them away from the caret. */
  showSyntax?: boolean;
  handle?: RefObject<MarkdownEditorHandle | null>;
  onCursor?: (cursor: MarkdownCursor) => void;
  /** Called when an edit would exceed maxLength; the edit is refused, never silently cut. */
  onLimit?: () => void;
  describedBy?: string;
  /** The source line (1-based) at the top of the view, as the reader scrolls Write or Preview. */
  onView?: (line: number) => void;
  /** Set by the editor shell: shares the reader's place between Write and Preview. */
  reading?: RefObject<ReadingBridge>;
}
