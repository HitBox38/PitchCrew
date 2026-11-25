import { useState } from 'react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { WritingPreference } from '@pitchcrew/core';
import { guideChange } from '../helpers.ts';

export const useWritingSettings = () => {
  const guide = useWorkspaceStore((s) => s.data?.quality?.writingGuide);
  const action = useWorkspaceStore((s) => s.action);
  const working = useWorkspaceStore((s) => s.working);
  const [editing, setEditing] = useState<WritingPreference | null | undefined>(undefined);
  const change = guideChange(action, guide?.revision);
  return { guide, working, editing, setEditing, change };
};
