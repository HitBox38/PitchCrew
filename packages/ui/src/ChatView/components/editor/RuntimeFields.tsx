import type { RuntimeId } from '@pitchcrew/core';
import type { ChatViewModel } from '../../types.ts';
import { runtimeLabels } from '@/lib/labels.ts';
import { ConversationSelect } from '../ConversationSelect.tsx';

/** The participant and runtime choices at the top of the conversation runtime panel. */
export const RuntimeFields = ({
  data,
  role,
  recipientItems,
  setRecipient,
  runtime,
  defaultRuntime,
  changeRuntime,
}: Pick<ChatViewModel, 'data' | 'role' | 'recipientItems' | 'setRecipient'> & {
  runtime: RuntimeId | undefined;
  defaultRuntime: RuntimeId;
  changeRuntime: (next: string) => void;
}) => {
  return (
    <>
      {recipientItems.length > 1 ? (
        <div className="field">
          <label htmlFor="conversation-participant">Agent</label>
          <ConversationSelect
            id="conversation-participant"
            compact={false}
            label="Configure participant"
            value={role.id}
            items={recipientItems}
            onChange={setRecipient}
          />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="conversation-runtime">Runtime</label>
        <ConversationSelect
          id="conversation-runtime"
          compact={false}
          label="Conversation runtime"
          value={runtime ?? 'agent'}
          items={[
            { value: 'agent', label: `Use agent default (${runtimeLabels[defaultRuntime]})` },
            ...data.runtimes
              .filter((entry) => entry.available)
              .map((entry) => ({ value: entry.id, label: runtimeLabels[entry.id] })),
          ]}
          onChange={changeRuntime}
        />
      </div>
    </>
  );
};
