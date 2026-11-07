import type { ChatComposerProps } from '../types.ts';
import { ComposerStop } from './ComposerStop.tsx';
import { ConversationSelect } from './ConversationSelect.tsx';
import { ComposerSubmit } from './ComposerSubmit.tsx';
import { followUpLabels, queueHoldWording, sendNote } from '../composer-status.ts';
import { conversationQueueHold } from '../queue-recovery-plan.ts';
import { composerRetryNote } from '../composer-retry.ts';

export const ComposerSendActions = (props: ChatComposerProps) => {
  const hasInput = !!props.draft.trim() || !!props.files.length;
  const canStop = !!props.running.length;
  const name = (id: string) => props.data.roles.find((role) => role.id === id)?.name ?? id;
  const status = {
    hasInput,
    busy: props.busy,
    busyElsewhere: props.busyElsewhere,
    sendMode: props.sendMode,
    running: props.running
      .filter((run) => !run.reviewSeatReservation)
      .map((run) => name(run.roleId)),
    asking: props.questions.map((question) => name(question.roleId)),
    queueHold: conversationQueueHold(props.data, props.thread),
  };
  const labels = followUpLabels(status);
  const note = composerRetryNote(props.retryMode) || (props.busy ? '' : sendNote(status));
  return (
    <div className="chat-send-actions">
      {props.busy && hasInput && !props.retryMode ? (
        <ConversationSelect
          label="Follow-up action"
          displayValue={
            <>
              <span className="chat-followup-wide">
                {props.sendMode === 'queue' ? labels.queue : labels.interrupt}
              </span>
              <span className="chat-followup-short">
                {props.sendMode === 'queue'
                  ? status.queueHold
                    ? queueHoldWording(status.queueHold).short
                    : props.questions.length
                      ? 'After answer'
                      : 'After reply'
                  : 'Interrupt'}
              </span>
            </>
          }
          description={props.sendMode === 'queue' ? labels.queue : labels.interrupt}
          className="chat-send-note"
          disabled={props.working}
          value={props.sendMode}
          items={[
            { value: 'queue', label: labels.queue },
            { value: 'interrupt', label: labels.interrupt },
          ]}
          onChange={(value) => props.setSendMode(value as 'queue' | 'interrupt')}
        />
      ) : null}
      {note ? <span className="chat-send-note">{note}</span> : null}
      {canStop ? <ComposerStop {...props} /> : null}
      {!canStop || hasInput ? <ComposerSubmit {...props} hasInput={hasInput} /> : null}
    </div>
  );
};
