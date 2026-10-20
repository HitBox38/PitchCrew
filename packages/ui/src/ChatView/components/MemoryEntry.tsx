import { useMemoryEntry } from '../hooks/useMemoryEntry.ts';
import type { AgentMemory } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
import { Textarea } from '@/components/ui/textarea/index.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import { MemoryEntryActions } from './MemoryEntryActions.tsx';
export const MemoryEntry = ({
  note,
  working,
  action,
  openSource,
}: {
  note: AgentMemory;
  working: boolean;
  action: Action;
  openSource: () => void;
}) => {
  const editor = useMemoryEntry(note, action);
  const { editing, content, setContent, tags, setTags } = editor;
  return (
    <article className="chat-memory-entry">
      {editing ? (
        <div className="form grid gap-3">
          <label className="field">
            Note
            <Textarea
              aria-label="Memory note"
              rows={4}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={8000}
            />
          </label>
          <label className="field">
            Tags
            <Input
              aria-label="Memory tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="Tags, separated by commas"
            />
          </label>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap">{note.content}</p>
          {note.tags.length ? <small>{note.tags.join(' · ')}</small> : null}
        </>
      )}
      <small>Updated {new Date(note.updatedAt).toLocaleString()}</small>
      <MemoryEntryActions
        note={note}
        editor={editor}
        working={working}
        action={action}
        openSource={openSource}
      />
    </article>
  );
};
