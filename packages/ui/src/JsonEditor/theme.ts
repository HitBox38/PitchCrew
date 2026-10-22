import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';

export const jsonTheme = EditorView.theme({
  '&': { color: 'var(--ink)', backgroundColor: 'transparent', fontSize: '13px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.65',
    overflow: 'auto',
    maxHeight: 'min(60vh, 640px)',
    minHeight: '320px',
  },
  '.cm-content': { padding: '14px 0', caretColor: 'var(--primary)' },
  '.cm-line': { padding: '0 16px' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    borderRight: '1px solid var(--border)',
    padding: '0 4px',
  },
  '.cm-activeLine': { backgroundColor: 'rgb(var(--tint) / 0.035)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink)' },
  '.cm-cursor': { borderLeftColor: 'var(--primary)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--primary-soft)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'var(--primary-soft)',
    outline: '1px solid var(--primary)',
    borderRadius: '2px',
  },
  '.cm-tooltip': {
    color: 'var(--ink)',
    background: 'var(--clay-fill)',
    border: '1px solid var(--border-strong)',
    borderRadius: '8px',
    boxShadow: 'var(--pop), var(--volume-sm)',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--font-mono)',
    maxWidth: 'min(480px, 80vw)',
    fontSize: '12px',
    padding: '4px',
  },
  '.cm-tooltip-autocomplete ul li': { borderRadius: '4px', padding: '4px 8px' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    color: 'var(--primary-deep)',
    background: 'var(--primary-soft)',
  },
  '.cm-completionDetail': {
    fontFamily: 'var(--font-sans)',
    color: 'var(--muted)',
    fontSize: '11px',
    marginLeft: '10px',
  },
  '.cm-diagnostic': { fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '6px 10px' },
  '.cm-diagnostic-error': { borderLeftColor: 'var(--rose)' },
  '.cm-lintRange-error': {
    textDecoration: 'underline wavy var(--rose)',
    backgroundImage: 'none',
    textUnderlineOffset: '3px',
  },
});

export const jsonHighlighting = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--primary-deep)' },
  { tag: tags.string, color: 'var(--teal)' },
  { tag: tags.number, color: 'var(--ochre)' },
  { tag: [tags.bool, tags.null], color: 'var(--plum)' },
  { tag: tags.punctuation, color: 'var(--ink-soft)' },
  { tag: tags.invalid, color: 'var(--rose)' },
]);
