import { ConversationSelect } from '@/ChatView/components/ConversationSelect.tsx';
import type { Conversation, Role } from '@pitchcrew/core';

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
    <ConversationSelect
      label={`${role.name} browser permissions`}
      disabled={disabled || !conversation}
      value={override?.browserMode ?? 'agent'}
      items={[
        {
          value: 'agent',
          label: `Agent default (${role.browserMode === 'autonomous' ? 'Autonomous' : 'Supervised'})`,
        },
        { value: 'supervised', label: 'Supervised' },
        { value: 'autonomous', label: 'Autonomous browsing' },
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
  );
}
