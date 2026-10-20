import { api } from '@/api.ts';
import type { SkillUpdatePreview } from '@pitchcrew/core';

export const previewSkillUpdate = (id: string, signal: AbortSignal) => {
  return api<SkillUpdatePreview>(`/skills/${id}/update/preview`, 'POST', undefined, signal);
};
