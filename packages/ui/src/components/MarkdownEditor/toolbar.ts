import type { KeyboardEvent } from 'react';
import {
  Bold,
  Code,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  SquareCode,
  Strikethrough,
  Table,
} from 'lucide-react';

/** Tools a keyboard can reach: enabled, and not folded away by the toolbar's width or mode. */
const tools = (toolbar: HTMLElement) =>
  [...toolbar.querySelectorAll<HTMLElement>('button:not(:disabled)')].filter(
    (tool) => tool.getClientRects().length > 0 && getComputedStyle(tool).visibility !== 'hidden',
  );

/** One tab stop for the whole toolbar: the last focused tool (the first one initially). */
export const keepOneTabStop = (toolbar: HTMLElement | null, current?: HTMLElement) => {
  if (!toolbar) return;
  const all = tools(toolbar);
  const stop = current && all.includes(current) ? current : all[0];
  for (const tool of all) tool.tabIndex = tool === stop ? 0 : -1;
};

/** Arrow keys, Home and End move between tools; Tab leaves the toolbar. */
export const roveToolbar = (event: KeyboardEvent<HTMLDivElement>) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const all = tools(event.currentTarget);
  const index = all.indexOf(document.activeElement as HTMLElement);
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? all.length - 1
        : (index + (event.key === 'ArrowLeft' ? -1 : 1) + all.length) % all.length;
  all[next]?.focus();
  event.preventDefault();
};

/** Tools that fold into "More formatting" when the sheet is narrow. */
export const extraTools = new Set(['strike', 'code', 'quote', 'codeblock', 'table', 'rule']);

export const inlineTools = [
  ['bold', 'Bold', Bold],
  ['italic', 'Italic', Italic],
  ['strike', 'Strikethrough', Strikethrough],
  ['code', 'Inline code', Code],
  ['link', 'Link', Link],
] as const;
export const blockTools = [
  ['bullet', 'Bulleted list', List],
  ['number', 'Numbered list', ListOrdered],
  ['task', 'Checklist', ListChecks],
  ['quote', 'Quote', Quote],
  ['codeblock', 'Code block', SquareCode],
  ['table', 'Table', Table],
  ['rule', 'Divider', Minus],
] as const;
