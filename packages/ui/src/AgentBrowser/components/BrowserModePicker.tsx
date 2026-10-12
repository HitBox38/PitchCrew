import { ConversationSelect } from '@/ChatView/components/ConversationSelect.tsx';
import type { Conversation, Role } from '@pitchcrew/core';
import { BrowserModeHelp } from './BrowserModeHelp.tsx';

export function BrowserModePicker({
  role,
  conversation,
  disabled,
  save,
}: {
  role: Role;
  conversation?: Conversation;
  disabled: boolean;
  save: (configuration: unknown) => void;
}) {
  const override = conversation?.configurations[role.id];
  return (
    <div className="flex min-w-0 items-center gap-1">
      {conversation && conversation.participants.length > 1 ? (
        <span className="quiet">{role.name}</span>
      ) : null}
      <ConversationSelect
        label={`${role.name} browser permissions`}
        disabled={disabled || !conversation}
        value={override?.browserMode ?? 'agent'}
        items={[
          {
            value: 'agent',
            label: `Agent default (${role.browserMode === 'autonomous' ? 'Autonomous preparation' : 'Supervised'})`,
          },
          { value: 'supervised', label: 'Supervised' },
          { value: 'autonomous', label: 'Autonomous preparation' },
        ]}
        onChange={(value) => {
          const { browserMode: _mode, ...other } = override ?? {};
          save({
            configurations: {
              [role.id]: { ...other, ...(value === 'agent' ? {} : { browserMode: value }) },
            },
          });
        }}
      />
      <BrowserModeHelp name={role.name} />
    </div>
  );
}
