import { useState } from 'react';
import type { AgentMemory } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
export const useMemoryEntry = (note: AgentMemory, action: Action) => {
  const save = async () => {
    await action(`/memories/${note.id}`, 'PUT', {
      content,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    setEditing(false);
  };

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState(note.tags.join(', '));
  return { editing, setEditing, deleting, setDeleting, content, setContent, tags, setTags, save };
};
