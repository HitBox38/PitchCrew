import { demo } from './demo/index.ts';
import { claudeCode } from './claude-code/index.ts';
import { codex } from './codex/index.ts';
import type { RuntimeAdapter, RuntimeId } from '@pitchcrew/core';
export const adapters: Record<RuntimeId, RuntimeAdapter> = {
  demo,
  'claude-code': claudeCode,
  codex,
};
