import { useState } from 'react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { WritingPreference } from '@pitchcrew/core';

export function useWritingSettings() {
  const guide = useWorkspaceStore((s) => s.data?.quality?.writingGuide);
  const action = useWorkspaceStore((s) => s.action);
  const working = useWorkspaceStore((s) => s.working);
  const [editing, setEditing] = useState<WritingPreference | null | undefined>(undefined);
  const change = (data: Record<string, unknown>) =>
    action('/quality', 'POST', { revision: guide?.revision, ...data }, 'Writing guide updated');
  return { guide, working, editing, setEditing, change };
}
