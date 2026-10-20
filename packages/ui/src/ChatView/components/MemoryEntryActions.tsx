import type { AgentMemory } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { useMemoryEntry } from '../hooks/useMemoryEntry.ts';

export const MemoryEntryActions = ({
  note,
  editor,
  working,
  action,
  openSource,
}: {
  note: AgentMemory;
  editor: ReturnType<typeof useMemoryEntry>;
  working: boolean;
  action: Action;
  openSource: () => void;
}) => {
  const { editing, setEditing, deleting, setDeleting, content, setContent, setTags, save } = editor;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button className="text-button" size="xs" variant="ghost" onClick={openSource}>
        View source
      </Button>
      {editing ? (
        <>
          <Button
            size="sm"
            disabled={working || !content.trim()}
            onClick={() => void save().catch(() => {})}
          >
            Save note
          </Button>
          <Button
            className="text-button"
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
        <Button className="text-button" size="xs" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
      )}
      {deleting ? (
        <>
          <Button
            size="sm"
            variant="destructive"
            disabled={working}
            onClick={() => void action(`/memories/${note.id}`, 'DELETE').catch(() => {})}
          >
            Delete note
          </Button>
          <Button
            className="text-button"
            size="xs"
            variant="ghost"
            onClick={() => setDeleting(false)}
          >
            Keep note
          </Button>
        </>
      ) : (
        <Button
          className="text-button danger"
          size="xs"
          variant="ghost"
          onClick={() => setDeleting(true)}
        >
          Delete
        </Button>
      )}
    </div>
  );
};
