import { randomUUID } from 'node:crypto';
import type { ChatContext, RunContext, RuntimeAdapter } from '@pitchcrew/core';
import { chatCli, detectCli, promptFor, runCli } from '../process.ts';
import { withMcpConfigFile } from '../process/mcp-config.ts';
import { claudeModelArgs, readClaudeModels } from './models.ts';

const argsFor = (context: RunContext | ChatContext, mcpConfig: string) => {
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
    '--setting-sources',
    '',
    '--permission-mode',
    'dontAsk',
    '--allowedTools',
    'mcp__pitchcrew__*',
    // A file path keeps the scoped run token out of the process command line.
    '--mcp-config',
    mcpConfig,
  ];
  if (!context.purpose && 'session' in context && context.session) {
    if (context.session.id) args.push('--resume', context.session.id);
    else {
      const id = randomUUID();
      args.push('--session-id', id);
      context.onSession?.(id);
    }
  } else args.push('--no-session-persistence');
  if (context.role.model) args.push('--model', context.role.model);
  if (context.role.reasoning) args.push('--effort', context.role.reasoning);
  return args;
};
const withClaudeMcpConfig = <T>(
  context: RunContext | ChatContext,
  use: (path: string) => Promise<T>,
) => withMcpConfigFile(context.directory, { mcpServers: { pitchcrew: context.mcp } }, use);
const extract = (event: Record<string, unknown>): string | null => {
  if (event.type === 'result' && typeof event.result === 'string') return event.result;
  return null;
};
export const claudeCode: RuntimeAdapter = {
  applicationIsolation: true,
  customReasoning: true,
  reviewSubagents: { maxConcurrent: 4 },
  id: 'claude-code',
  sessionSupport: 'resume',
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
  run: (context) =>
    withClaudeMcpConfig(context, (path) =>
      runCli('claude', argsFor(context, path), context, promptFor(context), extract),
    ),
  chat: (context) =>
    withClaudeMcpConfig(context, (path) =>
      chatCli('claude', argsFor(context, path), context, extract),
    ),
};
