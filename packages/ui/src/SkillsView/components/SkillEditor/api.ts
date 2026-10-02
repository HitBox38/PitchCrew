import { api } from '@/api.ts';
import type { SkillPreview } from '@pitchcrew/core';

export function previewSkill(url: string, signal: AbortSignal) {
  return api<SkillPreview>('/skills/preview', 'POST', { url }, signal);
}
