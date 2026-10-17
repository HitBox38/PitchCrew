import { api } from '../api.ts';
import type { SkillUpdatesState } from '@pitchcrew/core';

export const checkSkillUpdates = (automatic: boolean) =>
  api<SkillUpdatesState>('/skills/updates/check', 'POST', { automatic });
