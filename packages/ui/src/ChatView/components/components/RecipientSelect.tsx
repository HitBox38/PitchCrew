import type { RecipientSelectProps } from '@/ChatView/components/types.ts';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { SelectContent } from '@/components/ui/select/components/SelectContent.tsx';
import { SelectItem } from '@/components/ui/select/components/SelectItem.tsx';
import { SelectTrigger } from '@/components/ui/select/components/SelectTrigger.tsx';
import { SelectValue } from '@/components/ui/select/components/SelectValue.tsx';
import { Select } from '@/components/ui/select/constants.ts';
import type { RoleId } from '@pitchcrew/core';

export function RecipientSelect({
  recipient,
  recipientItems,
  working,
  setRecipient,
}: RecipientSelectProps) {
  return (
    <Select
      value={recipient}
      items={recipientItems}
      disabled={working}
      onValueChange={(value: RoleId | null) => {
        if (value) setRecipient(value);
      }}
    >
      <SelectTrigger
        className="chat-context-select chat-recipient-select"
        aria-label="Message recipient"
        size="sm"
      >
        <span className="chat-select-prefix">To</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent side="top" align="start" alignItemWithTrigger={false}>
        {recipientItems.map((item) => (
          <SelectItem value={item.value} key={item.value}>
            <RoleAvatar agentRole={item.value} size="small" />
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
