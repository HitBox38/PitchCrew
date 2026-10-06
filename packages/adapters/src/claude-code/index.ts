import type { ChatContext, RunContext, RuntimeAdapter } from '@pitchcrew/core';
import { chatCli, detectCli, promptFor, runCli } from '../process.ts';
import { claudeModelArgs, readClaudeModels } from './models.ts';

function argsFor(context: RunContext | ChatContext) {
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    ...('messages' in context ? ['--include-partial-messages'] : []),
    '--restricted',
    '--tools',
    '',
    '--strict-mcp-config',
    '--no-session-persistence',
    '--setting-sources',
    '',
    '--permission-mode',
    'dontAsk',
    '--allowedTools',
    'mcp__pitchcrew__*',
    '--mcp-config',
    JSON.stringify({ mcpServers: { pitchcrew: context.mcp } }),
  ];
  if (context.role.model) args.push('--model', context.role.model);
  if (context.role.reasoning) args.push('--effort', context.role.reasoning);
  return args;
}
function extract(event: Record<string, unknown>): string | null {
  if (event.type === 'result' && typeof event.result === 'string') return event.result;
  return null;
}
export const claudeCode: RuntimeAdapter = {
  id: 'claude-code',
  // Runtime aliases follow the CLI's model configuration without pinning versions.
  // https://code.claude.com/docs/en/model-config
  models: [
    {
      value: 'sonnet',
      label: 'Sonnet',
      reasoning: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] },
    },
    {
      value: 'opus',
      label: 'Opus',
      reasoning: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] },
    },
    { value: 'haiku', label: 'Haiku' },
    {
      value: 'fable',
      label: 'Fable',
      reasoning: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] },
    },
    {
      value: 'best',
      label: 'Best available',
      reasoning: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] },
    },
  ],
  listModels: (signal) => readClaudeModels('claude', claudeModelArgs, signal),
  detect: () => detectCli('claude-code', 'claude'),
  run: (context) => runCli('claude', argsFor(context), context, promptFor(context), extract),
  chat: (context) => chatCli('claude', argsFor(context), context, extract),
};
