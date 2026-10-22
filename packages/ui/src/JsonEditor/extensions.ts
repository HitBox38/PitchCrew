import { EditorState, Prec, StateEffect } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  bracketMatching,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import {
  acceptCompletion,
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete';
import { lintGutter, linter } from '@codemirror/lint';
import { formatJson } from './commands.ts';
import { jsonHighlighting, jsonTheme } from './theme.ts';
import type { JsonEditorProps } from './types.ts';
import { issueDiagnostics } from './helpers.ts';
import { jsonLineEndings, lineEnding } from './line-endings.ts';
import { autoFormatting } from './auto-format.ts';
import { useDevicePreferences } from '../lib/device-preferences.ts';

export const refreshJsonDiagnostics = StateEffect.define<null>();

export const editorExtensions = (
  props: JsonEditorProps,
  change: (value: string) => void,
  current: () => JsonEditorProps,
) => [
  json(),
  autoFormatting(() => useDevicePreferences.getState()),
  jsonLineEndings.of(EditorState.lineSeparator.of(lineEnding(props.value))),
  jsonTheme,
  lineNumbers(),
  history(),
  drawSelection(),
  highlightActiveLine(),
  indentOnInput(),
  indentUnit.of('  '),
  bracketMatching(),
  closeBrackets(),
  syntaxHighlighting(jsonHighlighting),
  lintGutter(),
  linter(
    (view) => {
      const syntax = jsonParseLinter()(view);
      if (syntax.length) return syntax;
      const latest = current();
      return issueDiagnostics(
        view.state,
        latest.value === view.state.sliceDoc() ? latest.issues : [],
      );
    },
    {
      delay: 300,
      needsRefresh: (update) =>
        update.transactions.some((transaction) =>
          transaction.effects.some((effect) => effect.is(refreshJsonDiagnostics)),
        ),
    },
  ),
  autocompletion({ override: [props.complete], activateOnTyping: true, interactionDelay: 0 }),
  Prec.highest(
    keymap.of([
      { key: 'Tab', run: acceptCompletion },
      { key: 'Mod-Shift-f', run: formatJson, preventDefault: true },
    ]),
  ),
  keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
  EditorState.tabSize.of(2),
  EditorView.contentAttributes.of({
    id: props.id,
    role: 'textbox',
    'aria-label': props.label,
    'aria-multiline': 'true',
    'aria-describedby': `${props.id}-help`,
    spellcheck: 'false',
    'data-private': 'true',
  }),
  EditorView.updateListener.of((update) => {
    if (update.docChanged) change(update.state.sliceDoc());
  }),
];
