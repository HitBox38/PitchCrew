import { ConversationSelect } from '@/ChatView/components/ConversationSelect.tsx';
import type { Conversation, Role } from '@pitchcrew/core';
import { BrowserModeHelp } from './BrowserModeHelp.tsx';
import { Globe } from 'lucide-react';

export const BrowserModePicker = ({
  role,
  conversation,
  disabled,
  save,
}: {
  role: Role;
  conversation?: Conversation;
  disabled: boolean;
  save: (configuration: unknown) => void;
}) => {
  const override = conversation?.configurations[role.id];
  const autonomous = (override?.browserMode ?? role.browserMode) === 'autonomous';
  const mode = autonomous ? 'Autonomous preparation' : 'Supervised';
  return (
    <div className="flex min-w-0 items-center gap-1">
      <ConversationSelect
        label={`${role.name} browser permissions`}
        description={`${role.name}: ${mode}${override?.browserMode ? '' : ', following agent defaults'}. Applies to the next turn.`}
        displayValue={mode}
        className={`chat-browser-mode${autonomous ? ' chat-browser-mode-autonomous' : ''}`}
        icon={<Globe size={13} aria-hidden="true" />}
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
};
