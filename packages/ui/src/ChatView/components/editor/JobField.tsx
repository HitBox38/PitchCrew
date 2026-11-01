import type { ChatViewModel } from '../../types.ts';
import { ConversationSelect } from '../ConversationSelect.tsx';

/** The conversation's attached job, locked once the conversation has messages. */
export const JobField = ({
  value,
  onChange,
  items,
  locked,
}: {
  value: string;
  onChange: (value: string) => void;
  items: ChatViewModel['jobItems'];
  locked: boolean;
}) => {
  return (
    <div className="field">
      <label htmlFor="conversation-job">Attached job</label>
      <ConversationSelect
        id="conversation-job"
        compact={false}
        label="Conversation job"
        value={value}
        items={items}
        onChange={onChange}
        disabled={locked}
      />
      <span className="optional">
        One job per conversation. Start another conversation for a different application.
      </span>
    </div>
  );
};
