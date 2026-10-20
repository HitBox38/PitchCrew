import { api } from '@/api.ts';
import type { SkillPreview } from '@pitchcrew/core';

export const previewSkill = (url: string, signal: AbortSignal) => {
  return api<SkillPreview>('/skills/preview', 'POST', { url }, signal);
};
