import { JobContextSelect } from '@/ChatView/components/components/JobContextSelect.tsx';
import { RecipientSelect } from '@/ChatView/components/components/RecipientSelect.tsx';
import type { ComposerContextProps } from '@/ChatView/types.ts';
import { PromptInputTools } from '@/components/ai-elements/prompt-input/components/PromptInputTools.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { stateLabels } from '@/lib/labels.ts';
import { ArrowRight } from 'lucide-react';

export function ComposerContext({
  thread,
  recipient,
  recipientItems,
  working,
  setRecipient,
  cardId,
  jobItems,
  busy,
  setJobs,
  attached,
  onOpenCard,
}: ComposerContextProps) {
  return (
    <PromptInputTools className="chat-context-tools">
      {thread === 'crew' ? (
        <RecipientSelect
          recipient={recipient}
          recipientItems={recipientItems}
          working={working}
          setRecipient={setRecipient}
        />
      ) : null}
      <JobContextSelect
        cardId={cardId}
        jobItems={jobItems}
        busy={busy}
        working={working}
        setJobs={setJobs}
        thread={thread}
        attached={attached}
      />
      {attached ? (
        <Button
          className="chat-attached-state"
          variant="ghost"
          onClick={() => onOpenCard(attached.id)}
        >
          {stateLabels[attached.state]}
          <ArrowRight size={12} />
        </Button>
      ) : null}
    </PromptInputTools>
  );
}
