import { EditorSelection, EditorState, type TransactionSpec } from '@codemirror/state';
import { editorText } from './line-endings.ts';

interface FormatPreferences {
  jsonFormatOnPaste: boolean;
  jsonFormatOnType: boolean;
}

const tokens = (text: string) => [
  ...text.matchAll(/"(?:\\.|[^"\\])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:]/g),
];

/** Keep the caret within the same JSON token when surrounding whitespace changes. */
const formattedSelection = (source: string, formatted: string, selection: EditorSelection) => {
  const before = tokens(source);
  const after = tokens(formatted);
  const position = (offset: number) => {
    const index = before.findIndex((token) => token.index + token[0].length >= offset);
    if (index < 0) return formatted.length;
    const oldToken = before[index]!;
    const newToken = after[index];
    if (!newToken) return formatted.length;
    return newToken.index + Math.max(0, Math.min(offset - oldToken.index, newToken[0].length));
  };
  return EditorSelection.create(
    selection.ranges.map((range) =>
      EditorSelection.range(position(range.anchor), position(range.head)),
    ),
    selection.mainIndex,
  );
};

/** Formatting joins the original edit so one Undo reverses a paste and its formatting. */
export const autoFormatting = (preferences: () => FormatPreferences) =>
  EditorState.transactionFilter.of((transaction) => {
    if (!transaction.docChanged || transaction.isUserEvent('input.type.compose'))
      return transaction;
    const settings = preferences();
    const paste = transaction.isUserEvent('input.paste') && settings.jsonFormatOnPaste;
    const typing = transaction.isUserEvent('input.type') && settings.jsonFormatOnType;
    if (!paste && !typing) return transaction;
    const source = transaction.newDoc.toString();
    let formatted: string;
    try {
      formatted = `${JSON.stringify(JSON.parse(source), null, 2)}\n`;
    } catch {
      return transaction;
    }
    if (source === formatted) return transaction;
    const format: TransactionSpec = {
      changes: { from: 0, to: transaction.newDoc.length, insert: editorText(formatted) },
      selection: formattedSelection(source, formatted, transaction.newSelection),
      sequential: true,
    };
    return [transaction, format];
  });
