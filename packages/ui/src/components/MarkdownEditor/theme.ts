import { HighlightStyle } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

/**
 * The note on the paper: Source Sans prose at the app's prose size and a readable measure,
 * Markdown marks in muted ink (hidden away from the caret), and every colour, radius and type
 * size from the design tokens so light and dark follow the app theme.
 */
export const markdownTheme = EditorView.theme({
  '&': { height: '100%', color: 'var(--ink)', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--md-font-size)',
    lineHeight: 'var(--md-line-height)',
    overflow: 'auto',
    overscrollBehavior: 'contain',
  },
  // The column is centered at the reading measure; the side padding stays clickable.
  '.cm-content': {
    // Room past the last line (like a code editor), so menus can open below it.
    padding: 'var(--md-pad-top) var(--md-gutter) 50vh',
    caretColor: 'var(--primary)',
  },
  '.cm-line': { padding: '0' },
  '.cm-placeholder': { color: 'var(--muted)', fontStyle: 'normal' },
  '.cm-md-hint': { color: 'var(--muted)', pointerEvents: 'none' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--primary)', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: 'var(--primary-soft)' },
  '.cm-line.cm-md-heading': { paddingTop: 'var(--md-heading-gap)', lineHeight: '1.3' },
  '.cm-line.cm-md-h1': { paddingTop: '0' },
  '.cm-line.cm-md-quote': {
    paddingLeft: '16px',
    boxShadow: 'inset 3px 0 0 var(--border-strong)',
    color: 'var(--ink-soft)',
  },
  '.cm-line:is(.cm-md-codeblock, .cm-md-table)': {
    paddingInline: '14px',
    background: 'rgb(var(--tint) / 0.045)',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-label)',
    lineHeight: 'var(--text-label--line-height)',
  },
  '.cm-line:is(.cm-md-codeblock-start, .cm-md-table-start)': {
    paddingTop: '8px',
    borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
  },
  '.cm-line:is(.cm-md-codeblock-end, .cm-md-table-end)': {
    paddingBottom: '8px',
    borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
  },
  '.cm-line:is(.cm-md-codeblock-start.cm-md-codeblock-end, .cm-md-table-start.cm-md-table-end)': {
    borderRadius: 'var(--radius-sm)',
  },
  '.cm-line.cm-md-rule': { color: 'var(--muted)' },
  '.cm-md-code-language': {
    float: 'right',
    cursor: 'pointer',
    padding: '0 6px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgb(var(--tint) / 0.07)',
    color: 'var(--muted)',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-detail)',
    lineHeight: 'var(--text-detail--line-height)',
  },
  // A rendered table: hairline grid, recessed header, the preview's cell rhythm.
  '.cm-md-table-widget': {
    margin: '0',
    overflowX: 'auto',
    cursor: 'text',
  },
  '.cm-md-table-widget table': {
    width: '100%',
    borderCollapse: 'collapse',
    fontVariantNumeric: 'tabular-nums',
    fontSize: 'var(--text-label)',
    lineHeight: 'var(--text-label--line-height)',
  },
  '.cm-md-table-widget :is(th, td)': {
    padding: '6px 12px',
    textAlign: 'left',
    verticalAlign: 'top',
    boxShadow: 'inset 0 -1px 0 var(--border)',
  },
  '.cm-md-table-widget th': {
    background: 'rgb(var(--tint) / 0.045)',
    color: 'var(--ink-soft)',
    fontWeight: '600',
  },
  '.cm-md-table-widget code': {
    padding: '1px 4px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgb(var(--tint) / 0.07)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.92em',
  },
  '.cm-md-table-widget .cm-md-table-more': { color: 'var(--muted)' },
  // Links in drawn table cells look like the preview's links.
  '.cm-md-cell-link': {
    color: 'var(--primary)',
    textDecoration: 'underline',
    textDecorationColor: 'color-mix(in srgb, var(--primary) 40%, transparent)',
    textUnderlineOffset: '3px',
  },
  '.cm-md-table-widget.cm-md-table-quoted': {
    paddingLeft: '16px',
    boxShadow: 'inset 3px 0 0 var(--border-strong)',
  },
  '.cm-md-table-in-list-1': { marginLeft: '1em' },
  '.cm-md-table-in-list-2': { marginLeft: '2em' },
  '.cm-md-table-in-list-3': { marginLeft: '3em' },
  '.cm-md-table-in-list-4': { marginLeft: '4em' },
  '.cm-md-table-widget:hover': {
    outline: '1px solid var(--border-strong)',
    outlineOffset: '2px',
    borderRadius: 'var(--radius-sm)',
  },
  // Hanging indent: the marker sits in the margin of its own wrapped lines. A drawn bullet is one
  // em wide; a task box is 16px, its 6px gap and the space after it, as in the preview.
  '.cm-line.cm-md-li': {
    paddingLeft: 'calc(1em + var(--md-indent, 0) * 0.24em)',
    textIndent: 'calc(-1em - var(--md-indent, 0) * 0.24em)',
  },
  '.cm-line.cm-md-li-task': {
    paddingLeft: 'calc(var(--md-task-indent) + var(--md-indent, 0) * 0.24em)',
    textIndent: 'calc(0px - var(--md-task-indent) - var(--md-indent, 0) * 0.24em)',
  },
  '.cm-md-inline-code': {
    padding: '1px 4px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgb(var(--tint) / 0.07)',
  },
  '.cm-md-task:not(.cm-md-checkbox)': {
    padding: '0 2px',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.88em',
    cursor: 'pointer',
  },
  '.cm-md-task:not(.cm-md-checkbox):hover': { background: 'var(--primary-soft)' },
  // Drawn like the shared checkbox: a recessed square, glazed with a check when done.
  '.cm-md-checkbox': {
    display: 'inline-grid',
    placeItems: 'center',
    width: '16px',
    height: '16px',
    marginRight: '6px',
    verticalAlign: '-2px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--sunken-fill)',
    boxShadow: 'inset 0 0 0 1px var(--md-box-edge), var(--clay-sunken)',
    color: 'var(--primary-foreground, #fff)',
    cursor: 'pointer',
  },
  '.cm-md-checkbox[data-checked="true"]': {
    background: 'var(--glaze-fill)',
    boxShadow: 'var(--shadow-glaze)',
  },
  '.cm-md-checkbox svg': { width: '12px', height: '12px' },
  // One em wide, like the hanging indent and the preview's list indent, so text lines up.
  '.cm-md-bullet': {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    margin: '0 calc(1em - 6px - 0.2em) 0 0.2em',
    verticalAlign: '0.2em',
    borderRadius: '50%',
    background: 'var(--ink-soft)',
  },
  // Find floats at the top right of the note instead of pushing it down.
  '.cm-panels': { backgroundColor: 'transparent', color: 'var(--ink)' },
  '.cm-panels.cm-panels-top': {
    position: 'absolute',
    top: '10px',
    right: 'var(--md-find-right, 16px)',
    left: 'var(--md-find-left, auto)',
    zIndex: '4',
    border: '0',
  },
  // Every match a faint tint; the current one solid with a ring, so it is never lost.
  '.cm-searchMatch': {
    borderRadius: '2px',
    backgroundColor: 'color-mix(in srgb, var(--primary) 14%, transparent)',
  },
  '.cm-md-revealed': {
    borderRadius: '2px',
    backgroundColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
    boxShadow: '0 0 0 2px var(--primary)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
    boxShadow: '0 0 0 2px var(--primary)',
  },
  '.cm-tooltip': {
    overflow: 'hidden',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-bright)',
    boxShadow: 'var(--pop)',
    color: 'var(--ink)',
  },
  // Scroll shadows: a soft edge appears where more options are hidden above or below.
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    minWidth: '264px',
    maxHeight: 'min(440px, 60vh)',
    overflowY: 'auto',
    padding: '4px',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-label)',
    background: [
      'linear-gradient(var(--surface-bright) 30%, transparent) center top',
      'linear-gradient(transparent, var(--surface-bright) 70%) center bottom',
      'radial-gradient(farthest-side at 50% 0, var(--md-scroll-shadow), transparent) center top',
      'radial-gradient(farthest-side at 50% 100%, var(--md-scroll-shadow), transparent) center bottom',
    ].join(', '),
    backgroundRepeat: 'no-repeat',
    backgroundSize: '100% 32px, 100% 32px, 100% 10px, 100% 10px',
    backgroundAttachment: 'local, local, scroll, scroll',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--radius-sm)',
    lineHeight: 'var(--text-label--line-height)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    background: 'rgb(var(--tint) / 0.08)',
    color: 'var(--ink)',
  },
  '.cm-completionIcon': { display: 'none' },
  '.cm-md-slash-icon': {
    display: 'grid',
    flex: 'none',
    placeItems: 'center',
    width: '24px',
    height: '24px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--clay-fill)',
    boxShadow: 'var(--clay)',
    color: 'var(--ink-soft)',
  },
  // Section labels head their group: space above, none below, no rule.
  '.cm-tooltip.cm-tooltip-autocomplete > ul > completion-section': {
    display: 'block',
    padding: '12px 10px 2px',
    borderBottom: '0',
    opacity: '1',
    color: 'var(--muted)',
    fontSize: 'var(--text-detail)',
    fontWeight: '600',
    lineHeight: 'var(--text-detail--line-height)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > completion-section:first-child': {
    paddingTop: '4px',
  },
  '.cm-completionLabel': { flex: 1 },
  '.cm-completionMatchedText': { textDecoration: 'none', fontWeight: '600' },
  '.cm-completionDetail': {
    marginLeft: '16px',
    color: 'var(--muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-detail)',
    fontStyle: 'normal',
  },
});

export const markdownHighlighting = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.6em', fontWeight: '600', letterSpacing: '-0.012em' },
  { tag: tags.heading2, fontSize: '1.3em', fontWeight: '600', letterSpacing: '-0.006em' },
  { tag: tags.heading3, fontSize: '1.12em', fontWeight: '600' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600' },
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--muted)' },
  {
    tag: tags.link,
    color: 'var(--primary)',
    textDecoration: 'underline',
    textDecorationColor: 'color-mix(in srgb, var(--primary) 40%, transparent)',
    textUnderlineOffset: '3px',
  },
  { tag: tags.url, color: 'var(--muted)' },
  { tag: tags.monospace, fontFamily: 'var(--font-mono)', fontSize: '0.88em' },
  { tag: [tags.processingInstruction, tags.meta, tags.labelName], color: 'var(--muted)' },
  { tag: tags.quote, color: 'var(--ink-soft)' },
  { tag: tags.contentSeparator, color: 'var(--muted)' },
  { tag: tags.comment, color: 'var(--muted)', fontStyle: 'italic' },
  // Code in fenced blocks, in the JSON editor's palette.
  { tag: [tags.keyword, tags.operatorKeyword, tags.modifier], color: 'var(--plum)' },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--teal)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--ochre)' },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--primary-deep)',
  },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--primary)' },
  { tag: [tags.propertyName, tags.attributeName], color: 'var(--primary-deep)' },
  { tag: [tags.tagName], color: 'var(--rose)' },
]);
