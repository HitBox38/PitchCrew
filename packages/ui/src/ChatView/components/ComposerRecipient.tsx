import type { ChatComposerProps } from '../types.ts';
import { messageTargets, recipientLabel } from '../composer-status.ts';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';

/**
 * The clay composer names who the drafted message reaches. It follows the daemon's routing rather
 * than the runtime selection: a group message goes to everyone unless it @mentions participants.
 */
export const ComposerRecipient = ({ participants, recipientItems, draft }: ChatComposerProps) => {
  if (!participants.length) return null;
  const name = (id: string) => recipientItems.find((item) => item.value === id)?.label ?? id;
  const targets = messageTargets(draft, participants);
  const label = recipientLabel(targets, participants, name);
  const group = participants.length > 1;
  return (
    <span
      className="chat-composer-recipient"
      data-group={group ? '' : undefined}
      data-empty={targets.length ? undefined : ''}
      title={group ? 'Mention @agent to address specific participants' : undefined}
    >
      <span className="chat-composer-recipient-avatars" aria-hidden="true">
        {targets.slice(0, 3).map((id) => (
          <RoleAvatar key={id} agentRole={id} size="small" />
        ))}
      </span>
      <span className={group ? 'chat-select-prefix' : 'sr-only'}>{group ? 'To' : 'Messaging'}</span>
      <span className="chat-composer-recipient-name">{label}</span>
    </span>
  );
};
