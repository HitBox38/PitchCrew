import type { KeptComposerDraft } from '../composer-state.ts';
import { Button } from '@pitchcrew/design-system/button';
import { QueueDiagnostics } from './QueueDiagnostics.tsx';
import { attachmentSize } from '../attachment-helpers.ts';

/** A recovery preview is read-only; using it swaps complete payloads without concatenation. */
export const ComposerKeptDraft = ({
  draft,
  disabled,
  useDraft,
  discardDraft,
}: {
  draft: KeptComposerDraft;
  disabled: boolean;
  useDraft: () => void;
  discardDraft: (control: HTMLButtonElement) => void;
}) => (
  <article className="chat-kept-draft">
    <h3>{draft.label}</h3>
    {draft.payload.text ? (
      <pre className="break-words whitespace-pre-wrap">{draft.payload.text}</pre>
    ) : null}
    {draft.payload.references.length ? (
      <p>{draft.payload.references.map((reference) => reference.token).join(' · ')}</p>
    ) : null}
    {draft.payload.files.length ? (
      <ul>
        {draft.payload.files.map((file, index) => (
          <li key={index}>
            {file.name} · {attachmentSize(file.size)}
          </li>
        ))}
      </ul>
    ) : null}
    {draft.details ? (
      <QueueDiagnostics entries={[{ label: 'Send details', text: draft.details }]} />
    ) : null}
    <div className="chat-kept-draft-actions">
      <Button
        data-kept-draft-use=""
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={useDraft}
      >
        Use this draft
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={(event) => discardDraft(event.currentTarget)}
      >
        Discard kept draft
      </Button>
    </div>
  </article>
);
