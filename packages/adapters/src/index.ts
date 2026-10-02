import { demo } from './demo/index.ts';
import { claudeCode } from './claude-code/index.ts';
import { codex } from './codex/index.ts';
import { geminiCli } from './gemini-cli/index.ts';
import { opencode } from './opencode/index.ts';
import { copilotCli } from './copilot-cli/index.ts';
import { cursorAgent } from './cursor-agent/index.ts';
import { goose } from './goose/index.ts';
import { kiroCli } from './kiro-cli/index.ts';
import { grok } from './grok/index.ts';
import { pi } from './pi/index.ts';
import { ohMyPi } from './oh-my-pi/index.ts';
import type { RuntimeAdapter, RuntimeId } from '@pitchcrew/core';
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
