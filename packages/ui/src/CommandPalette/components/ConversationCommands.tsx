import { useCommandState } from 'cmdk';
import { Archive, MessageSquare } from 'lucide-react';
import type { ConversationCommandsProps } from '@/CommandPalette/types.ts';
import { CommandGroup } from '@pitchcrew/design-system/command';
import { matchingConversations } from '../helpers.ts';
import { PaletteItem } from './PaletteItem.tsx';

export const ConversationCommands = ({
  cards,
  roles,
  conversations,
  run,
  onOpenConversation,
}: ConversationCommandsProps) => {
  const search = useCommandState((state) => state.search);
  const entries = matchingConversations({ cards, roles, conversations }, search);
  if (!entries.length) return null;
  return (
    <CommandGroup heading="Conversations">
      {entries.map(({ conversation, context, value }) => (
        <PaletteItem
          key={conversation.id}
          value={value}
          icon={conversation.archived ? Archive : MessageSquare}
          label={conversation.title}
          context={conversation.archived ? `Archived · ${context}` : context}
          onSelect={run(() => onOpenConversation(conversation.id))}
        />
      ))}
    </CommandGroup>
  );
};
