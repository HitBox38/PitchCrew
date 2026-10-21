import type { ChatComposerProps } from '../types.ts';
import { ComposerStop } from './ComposerStop.tsx';
import { ConversationSelect } from './ConversationSelect.tsx';
import { ComposerSubmit } from './ComposerSubmit.tsx';

export const ComposerSendActions = (props: ChatComposerProps) => {
  const hasInput = !!props.draft.trim() || !!props.files.length;
  const canStop = !!props.running.length;
  return (
    <div className="chat-send-actions">
      {props.busy && hasInput ? (
        <ConversationSelect
          label="Follow-up action"
          disabled={props.working}
          value={props.sendMode}
          items={[
            { value: 'queue', label: 'After reply' },
            { value: 'interrupt', label: 'Interrupt' },
          ]}
          onChange={(value) => props.setSendMode(value as 'queue' | 'interrupt')}
        />
      ) : null}
      {canStop ? <ComposerStop {...props} /> : null}
      {!canStop || hasInput ? <ComposerSubmit {...props} hasInput={hasInput} /> : null}
    </div>
  );
};
