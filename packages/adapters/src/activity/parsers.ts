import type { RuntimeId } from '@pitchcrew/core';
import type { NativeToolParser } from './native-tools.ts';
import { claudeCodeTools } from '../claude-code/tools.ts';
import { codexTools } from '../codex/tools.ts';
import { opencodeTools } from '../opencode/tools.ts';
import { geminiCliTools } from '../gemini-cli/tools.ts';
import { copilotCliTools } from '../copilot-cli/tools.ts';
import { cursorAgentTools } from '../cursor-agent/tools.ts';
import { gooseTools } from '../goose/tools.ts';
import { hermesTools } from '../hermes/tools.ts';
import { grokTools } from '../grok/tools.ts';
import { piTools } from '../pi/tools.ts';
import { ohMyPiTools } from '../oh-my-pi/tools.ts';

/**
 * Native tool parsers for line-delimited CLI streams, by runtime. Kiro speaks ACP and uses
 * `acpTools` from acp.ts; the Demo runtime reports its steps directly.
 */
export const nativeToolParsers: Partial<Record<RuntimeId, NativeToolParser>> = {
  'claude-code': claudeCodeTools,
  codex: codexTools,
  opencode: opencodeTools,
  'gemini-cli': geminiCliTools,
  'copilot-cli': copilotCliTools,
  'cursor-agent': cursorAgentTools,
  goose: gooseTools,
  hermes: hermesTools,
  grok: grokTools,
  pi: piTools,
  'oh-my-pi': ohMyPiTools,
};
