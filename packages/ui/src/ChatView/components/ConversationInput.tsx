import { Button } from '@pitchcrew/design-system/button';
import { activeQuestion } from '@/UserQuestions/helpers.ts';
import type { ChatViewModel } from '../types.ts';
import { ChatComposer } from './ChatComposer.tsx';
import { useRef } from 'react';
import { useQuestionComposer } from '@/UserQuestions/hooks/useQuestionComposer.ts';
import { useComposerViewport } from '@/ChatView/hooks/useComposerViewport.ts';

/** The question is the current input; ordinary drafts remain mounted and keep their files. */
export const ConversationInput = (props: ChatViewModel) => {
  const composerRef = useRef<HTMLElement>(null);
  useComposerViewport(composerRef, props.thread);
  const questionId = activeQuestion(props.questions, props.activeQuestionId);
  const recoveryWork = !!(
    props.composer.operation ||
    props.composer.notice ||
    props.composer.refreshNeeded
  );
  const answering =
    !props.readOnly &&
    !!questionId &&
    !props.busy &&
    !props.draft.trim() &&
    !props.files.length &&
    !props.draftReferences.length &&
    !props.composer.kept.length &&
    !recoveryWork;
  const hidden = useQuestionComposer(
    composerRef,
    answering,
    questionId,
    props.draft,
    props.thread,
    props.files.length +
      props.draftReferences.length +
      props.composer.kept.length +
      Number(recoveryWork),
  );
  if (props.readOnly)
    return (
      <div className="chat-readonly">
        {props.conversation?.kind === 'agent_dm'
          ? 'Agent DM · read-only. Start a separate conversation to give either agent direction.'
          : 'Crew history · read-only. Start a new conversation to continue working.'}
      </div>
    );
  return (
    <>
      {hidden ? (
        <div className="chat-question-compose-switch">
          <Button variant="ghost" onClick={props.writeMessage}>
            Write a message for later
          </Button>
        </div>
      ) : null}
      <ChatComposer {...props} hidden={hidden} composerRef={composerRef} />
    </>
  );
};
