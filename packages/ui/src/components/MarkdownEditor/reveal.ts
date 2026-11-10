import { StateEffect, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

/** Marks a found passage (a search hit, a cited quote) without selecting it. */
export const revealMatch = StateEffect.define<{ from: number; to: number }>();
const revealed = Decoration.mark({ class: 'cm-md-revealed' });

/**
 * The passage a search or citation led to is selected (typing replaces it, as in a code editor)
 * and marked until the next edit or a selection elsewhere. While the selection is exactly that
 * passage, ⌘K still opens the command palette instead of linking it (see `isRevealed`).
 */
export const revealedMatch = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (value, transaction) => {
    for (const effect of transaction.effects)
      if (effect.is(revealMatch) && effect.value.to > effect.value.from)
        return Decoration.set(revealed.range(effect.value.from, effect.value.to));
    if (transaction.docChanged) return Decoration.none;
    if (!transaction.selection || value.size === 0) return value;
    const { from, to } = transaction.state.selection.main;
    let kept = false;
    value.between(from, to, (start, end) => {
      kept ||= from >= start && to <= end;
    });
    return kept ? value : Decoration.none;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** The selection is exactly a passage a search led to (not something the user selected). */
export const isRevealed = (state: EditorState) => {
  const { from, to, empty } = state.selection.main;
  let exact = false;
  if (!empty)
    state.field(revealedMatch).between(from, to, (start, end) => {
      exact ||= start === from && end === to;
    });
  return exact;
};

/** Where typing should start in a note opened at its top: after a heading, list or quote mark. */
export const startOfText = (state: EditorState) =>
  /^(?:#{1,6} |[-*+] (?:\[[ xX]\] )?|\d+[.)] |> )/.exec(state.doc.line(1).text)?.[0].length ?? 0;
