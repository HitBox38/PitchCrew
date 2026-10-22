import { isolateHistory } from '@codemirror/commands';
import { Transaction } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { editorText } from './line-endings.ts';

export const formatJson = (view: EditorView): boolean => {
  let formatted: string;
  try {
    formatted = `${JSON.stringify(JSON.parse(view.state.doc.toString()), null, 2)}\n`;
  } catch {
    return false;
  }
  if (formatted !== view.state.doc.toString())
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: editorText(formatted) },
      annotations: [Transaction.userEvent.of('input.format'), isolateHistory.of('full')],
    });
  return true;
};
