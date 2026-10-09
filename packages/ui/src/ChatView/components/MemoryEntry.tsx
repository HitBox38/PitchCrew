import { useMemoryEntry } from '../hooks/useMemoryEntry.ts';
import type { AgentMemory } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Textarea } from '@/components/ui/textarea/index.tsx';
import { Input } from '@/components/ui/input/index.tsx';
export function MemoryEntry({
  note,
  working,
  action,
  openSource,
}: {
  note: AgentMemory;
  working: boolean;
  action: Action;
  openSource: () => void;
}) {
  const { editing, setEditing, deleting, setDeleting, content, setContent, tags, setTags, save } =
    useMemoryEntry(note, action);
  return (
    <article className="chat-memory-entry">
      {editing ? (
        <div className="grid gap-2">
          <Textarea
            aria-label="Memory note"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={8000}
          />
          <Input
            aria-label="Memory tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="Tags, separated by commas"
          />
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap">{note.content}</p>
          {note.tags.length ? <small>{note.tags.join(' · ')}</small> : null}
        </>
      )}
      <small>Updated {new Date(note.updatedAt).toLocaleString()}</small>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" variant="ghost" onClick={openSource}>
          View source
        </Button>
        {editing ? (
          <>
            <Button
              size="xs"
              disabled={working || !content.trim()}
              onClick={() => void save().catch(() => {})}
            >
              Save note
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setContent(note.content);
                setTags(note.tags.join(', '));
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        {deleting ? (
          <>
            <Button
              size="xs"
              variant="destructive"
              disabled={working}
              onClick={() => void action(`/memories/${note.id}`, 'DELETE').catch(() => {})}
            >
              Delete note
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setDeleting(false)}>
              Keep note
            </Button>
          </>
        ) : (
          <Button size="xs" variant="ghost" onClick={() => setDeleting(true)}>
            Delete
          </Button>
        )}
      </div>
    </article>
  );
}
