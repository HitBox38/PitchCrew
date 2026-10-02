import { ComposerContext } from '@/ChatView/components/ComposerContext.tsx';
import { ComposerHint } from '@/ChatView/components/ComposerHint.tsx';
import type { ChatComposerProps } from '@/ChatView/types.ts';
import { PromptInput } from '@/components/ai-elements/prompt-input/components/PromptInput.tsx';
import { PromptInputBody } from '@/components/ai-elements/prompt-input/components/PromptInputBody.tsx';
import { PromptInputFooter } from '@/components/ai-elements/prompt-input/components/PromptInputFooter.tsx';
import { PromptInputSubmit } from '@/components/ai-elements/prompt-input/components/PromptInputSubmit.tsx';
import { PromptInputTextarea } from '@/components/ai-elements/prompt-input/components/PromptInputTextarea.tsx';
import { runtimeLabels } from '@/lib/labels.ts';
import { Send } from 'lucide-react';

export function ChatComposer({
  role,
  available,
  error,
  send,
  inputRef,
  busy,
  draft,
  setDrafts,
  thread,
  working,
  recipient,
  recipientItems,
  setRecipient,
  cardId,
  jobItems,
  setJobs,
  attached,
  onOpenCard,
}: ChatComposerProps) {
  return (
    <div className="chat-compose">
      {!role.enabled || !available ? (
        <p className="form-error">
          {!role.enabled
            ? `${role.name} is paused. Enable this role in its settings to chat.`
            : `${runtimeLabels[role.runtime]} is not available. Choose an installed runtime in role settings.`}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <PromptInput onSubmit={({ text }) => send(text)} className="chat-prompt">
        <PromptInputBody>
          <PromptInputTextarea
            ref={inputRef}
            aria-label={`Message ${role.name}`}
            placeholder={busy ? `${role.name} is working…` : `Message ${role.name}…`}
            value={draft}
            onChange={(e) => setDrafts((current) => ({ ...current, [thread]: e.target.value }))}
            disabled={busy || working || !role.enabled || !available}
            maxLength={8000}
            className="chat-textarea"
          />
        </PromptInputBody>
        <PromptInputFooter className="chat-prompt-footer">
          <ComposerContext
            thread={thread}
            recipient={recipient}
            recipientItems={recipientItems}
            working={working}
            setRecipient={setRecipient}
            cardId={cardId}
            jobItems={jobItems}
            busy={busy}
            setJobs={setJobs}
            attached={attached}
            onOpenCard={onOpenCard}
          />
          <PromptInputSubmit
            className="button primary chat-send"
            aria-label="Send message"
            status={working ? 'submitted' : 'ready'}
            disabled={!draft.trim() || busy || working || !role.enabled || !available}
          >
            <Send size={15} />
            <span>Send</span>
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
      <ComposerHint role={role} />
    </div>
  );
}
