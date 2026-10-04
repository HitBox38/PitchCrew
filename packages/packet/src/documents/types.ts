// A small document model shared by the formatted PDF and DOCX renderers.
export interface TextRun {
  kind: 'text';
  text: string;
  bold: boolean;
  italic: boolean;
  href?: string;
}
// `fill` pushes the rest of a line to the right margin, like LaTeX \hfill before a date.
export type Run = TextRun | { kind: 'break' } | { kind: 'fill' };

export interface ListItem {
  depth: number;
  ordered: boolean;
  // Number shown for ordered items, counted within its own list level.
  number: number;
  runs: Run[];
}
export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; runs: Run[] }
  | { kind: 'paragraph'; runs: Run[] }
  | { kind: 'list'; items: ListItem[] }
  | { kind: 'rule' };

export type DocumentKind = 'resume' | 'coverLetter';
