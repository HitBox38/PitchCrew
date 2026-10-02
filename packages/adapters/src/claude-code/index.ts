import type { RuntimeAdapter, RunContext, ChatContext } from '@pitchcrew/core';
import { detectCli, promptFor, runCli, chatCli } from '../process.ts';
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
    { value: 'sonnet', label: 'Sonnet' },
    { value: 'opus', label: 'Opus' },
    { value: 'haiku', label: 'Haiku' },
    { value: 'fable', label: 'Fable' },
    { value: 'best', label: 'Best available' },
  ],
  detect: () => detectCli('claude-code', 'claude'),
  run: (context) => runCli('claude', argsFor(context), context, promptFor(context), extract),
  chat: (context) => chatCli('claude', argsFor(context), context, extract),
};
