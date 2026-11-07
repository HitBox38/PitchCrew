import type { ChatComposerProps } from '../types.ts';
import { PromptInputSubmit } from '@/components/ai-elements/prompt-input/components/PromptInputSubmit.tsx';
import { Send } from 'lucide-react';
import { nameList, queueHoldWording } from '../composer-status.ts';
import { conversationQueueHold } from '../queue-recovery-plan.ts';
import { composerRetryLabel, composerRetryNote } from '../composer-retry.ts';

export const ComposerSubmit = ({
  hasInput,
  ...props
}: ChatComposerProps & { hasInput: boolean }) => {
  const interruptLabel = props.busyElsewhere ? 'Stop current and send' : 'Interrupt and send';
  const held = !!props.questions.length && (!props.busy || props.sendMode === 'queue');
  const hold =
    (!props.busy || props.sendMode === 'queue') && conversationQueueHold(props.data, props.thread);
  const wording = hold && queueHoldWording(hold);
  const asking = nameList(
    props.questions.map(
      (question) =>
        props.data.roles.find((role) => role.id === question.roleId)?.name ?? question.roleId,
    ),
  );
  return (
    <PromptInputSubmit
      className="button primary chat-send"
      aria-label={
        props.retryMode
          ? composerRetryLabel(props.retryMode)
          : held
            ? wording
              ? `Queue message until you answer and ${wording.conjunction}`
              : 'Queue message for after your answer'
            : wording
              ? `Queue message for after ${wording.after}`
              : props.busy && props.sendMode === 'queue'
                ? 'Queue follow-up'
                : props.busy
                  ? interruptLabel
                  : 'Send message'
      }
      title={
        props.retryMode
          ? composerRetryNote(props.retryMode)
          : held
            ? `Sends after you answer ${asking}${wording ? ` and ${wording.conjunction}` : ''} · Enter to queue`
            : wording
              ? `Sends after ${wording.after} · Enter to queue`
              : props.busy && props.sendMode === 'interrupt'
                ? interruptLabel
                : 'Enter to send · Shift + Enter for a new line'
      }
      status={props.sending ? 'submitted' : 'ready'}
      disabled={!hasInput || props.working || props.sending || !props.available}
    >
      <Send size={15} />
      <span>{props.retryMode ? 'Retry' : 'Send'}</span>
    </PromptInputSubmit>
  );
};
