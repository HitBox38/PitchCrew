import type { RuntimeAdapter, RuntimeId } from '@pitchcrew/core';
import { claudeCode } from './claude-code/index.ts';
import { codex } from './codex/index.ts';
import { copilotCli } from './copilot-cli/index.ts';
import { cursorAgent } from './cursor-agent/index.ts';
import { demo } from './demo/index.ts';
import { geminiCli } from './gemini-cli/index.ts';
import { goose } from './goose/index.ts';
import { grok } from './grok/index.ts';
import { kiroCli } from './kiro-cli/index.ts';
import { ohMyPi } from './oh-my-pi/index.ts';
import { opencode } from './opencode/index.ts';
import { pi } from './pi/index.ts';

export { discoverModels, suggestedModels } from './model-discovery.ts';
export const adapters: Record<RuntimeId, RuntimeAdapter> = {
  demo,
  'claude-code': claudeCode,
  codex,
  'gemini-cli': geminiCli,
  opencode,
  'copilot-cli': copilotCli,
  'cursor-agent': cursorAgent,
  goose,
  'kiro-cli': kiroCli,
  grok,
  pi,
  'oh-my-pi': ohMyPi,
};
