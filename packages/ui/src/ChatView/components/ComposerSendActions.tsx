import type { ChatComposerProps } from '../types.ts';
import { ComposerStop } from './ComposerStop.tsx';
import { ConversationSelect } from './ConversationSelect.tsx';
import { ComposerSubmit } from './ComposerSubmit.tsx';
import { followUpLabels, sendNote } from '../composer-status.ts';

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
  };
  const labels = followUpLabels(status);
  const note = props.busy ? '' : sendNote(status);
  return (
    <div className="chat-send-actions">
      {props.busy && hasInput ? (
        <ConversationSelect
          label="Follow-up action"
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
