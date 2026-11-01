import type { ChatViewModel } from '../types.ts';
import { ChatSidePanel } from './ChatSidePanel.tsx';
import { ConversationSelect } from './ConversationSelect.tsx';
import { MemoryEntry } from './MemoryEntry.tsx';
import { PanelSection } from './PanelSection.tsx';
import { Input } from '@pitchcrew/design-system/input';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { useState } from 'react';
const intro =
  'Local notes recalled when relevant or when you ask. Changes apply on the agent’s next turn.';
export const MemoryNotebook = ({
  data,
  roleId,
  recipientItems,
  setRecipient,
  setDialog,
  action,
  onThread,
  working,
}: Pick<
  ChatViewModel,
  | 'data'
  | 'roleId'
  | 'recipientItems'
  | 'setRecipient'
  | 'setDialog'
  | 'action'
  | 'onThread'
  | 'working'
>) => {
  const [query, setQuery] = useState('');
  const notes = (data.memories ?? [])
    .filter(
      (note) =>
        note.roleId === roleId &&
        !note.deleted &&
        `${note.content} ${note.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <ChatSidePanel
      title={`${data.roles.find((role) => role.id === roleId)?.name ?? roleId} memory`}
      onClose={() => setDialog(null)}
      className="chat-memory-notebook"
      icon={<RoleAvatar agentRole={roleId} />}
      description={intro}
    >
      <PanelSection className="chat-memory-filters">
        {recipientItems.length > 1 ? (
          <ConversationSelect
            label="Agent memory"
            compact={false}
            value={roleId}
            items={recipientItems}
            onChange={setRecipient}
          />
        ) : null}
        <Input
          aria-label="Search agent memory"
          placeholder="Search notes and tags"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </PanelSection>
      <div className="chat-memory-list grid gap-3 overflow-auto">
        {notes.map((note) => (
          <MemoryEntry
            key={note.id}
            note={note}
            working={working}
            action={action}
            openSource={() => {
              onThread(note.source.threadId);
              setDialog(null);
            }}
          />
        ))}
        {!notes.length ? (
          <p className="quiet py-8 text-center">
            {query
              ? 'No matching notes.'
              : 'No saved notes yet. Ask this agent to remember something useful.'}
          </p>
        ) : null}
      </div>
    </ChatSidePanel>
  );
};
