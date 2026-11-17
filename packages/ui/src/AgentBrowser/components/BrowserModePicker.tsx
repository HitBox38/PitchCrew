import { ConversationSelect } from '@/ChatView/components/ConversationSelect.tsx';
import type { Conversation, Role } from '@pitchcrew/core';
import {
  browserModeActsAlone,
  browserModeLabels,
  browserModeSummaries,
} from '@pitchcrew/core/browser-modes';
import {
  browserModeOptions,
  conversationBrowserMode,
  savedBrowserMode,
} from '@/lib/browser-modes.ts';
import { BrowserModeHelp } from './BrowserModeHelp.tsx';
import { Globe } from 'lucide-react';

/**
 * The agent's browser permissions for its next turns in this conversation: its saved default or
 * one of the modes. The wrapper carries the mode, so its chip is styled without `:has()`.
 */
export const BrowserModePicker = ({
  role,
  conversation,
  disabled,
  save,
}: {
  /** The saved role, so Agent default names its saved mode rather than an override. */
  role: Role;
  conversation?: Conversation;
  disabled: boolean;
  save: (configuration: unknown) => void;
}) => {
  const override = conversation?.configurations[role.id];
  const mode = conversationBrowserMode(role, conversation);
  const label = browserModeLabels[mode];
  return (
    <div
      className="chat-browser-mode-picker flex min-w-0 items-center gap-1"
      data-mode={mode}
      data-acts-alone={browserModeActsAlone(mode) || undefined}
    >
      <ConversationSelect
        label={`${role.name} browser permissions`}
        description={`${role.name}: ${label}${override?.browserMode ? '' : ', following agent defaults'}. ${browserModeSummaries[mode]} Applies to the next turn.`}
        displayValue={label}
        className="chat-browser-mode"
        icon={<Globe size={13} aria-hidden="true" />}
        disabled={disabled || !conversation}
        value={override?.browserMode ?? 'agent'}
        items={[
          { value: 'agent', label: `Agent default (${browserModeLabels[savedBrowserMode(role)]})` },
          ...browserModeOptions,
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
