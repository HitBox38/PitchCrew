import { useReferenceAvailability } from '../hooks/useReferenceAvailability.ts';
import { useReferenceClipboard } from '../hooks/useReferenceClipboard.ts';
import { DraftReferenceDetails } from './DraftReferenceDetails.tsx';
import { useDraftDetails } from '../hooks/useDraftDetails.ts';
// A structured contenteditable textbox is required for atomic inline references.
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { useEditorKeyboard } from '../hooks/useEditorKeyboard.ts';
import { useState } from 'react';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useEditorSync } from '../hooks/useEditorSync.ts';
import { useSuggestions } from '../hooks/useSuggestions.ts';
import { SuggestionList } from './SuggestionList.tsx';
import type { ComposerEditorProps } from '../types.ts';

export const EditorSurface = (props: ComposerEditorProps) => {
  const [caret, setCaret] = useState<number | null>(null);
  const editor = useEditorSync(props, setCaret);
  const suggestions = useSuggestions(props, caret, editor);
  useEditorKeyboard(editor, props, suggestions);
  useReferenceClipboard(editor);
  useReferenceAvailability(editor, props.suggestions);
  const details = useDraftDetails(editor);
  return (
    <div className="chat-editor-anchor">
      {suggestions.open ? (
        <SuggestionList {...suggestions} symbol={suggestions.trigger!.symbol} />
      ) : null}
      <PlainTextPlugin
        ErrorBoundary={LexicalErrorBoundary}
        contentEditable={
          <ContentEditable
            className="chat-textarea chat-rich-input"
            role="textbox"
            aria-label={props.label}
            aria-multiline="true"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-controls={suggestions.open ? suggestions.id : undefined}
            aria-activedescendant={
              suggestions.open && suggestions.active >= 0
                ? `${suggestions.id}-${suggestions.active}`
                : undefined
            }
            aria-placeholder={props.placeholder}
            placeholder={<span className="chat-editor-placeholder">{props.placeholder}</span>}
            onClick={details.inspect}
            onBlur={() => {
              suggestions.close();
            }}
          />
        }
      />
      {details.details ? (
        <DraftReferenceDetails {...details.details} close={details.close} remove={details.remove} />
      ) : null}
      <input type="hidden" name="message" value={props.value} />
    </div>
  );
};
