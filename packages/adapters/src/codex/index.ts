import type { ChatContext, RunContext, RuntimeAdapter } from '@pitchcrew/core';
import { chatCli, detectCli, promptFor, runCli } from '../process.ts';
import { codexModelArgs, readCodexModels } from './models.ts';

function argsFor(context: RunContext | ChatContext) {
  const args = [
    'exec',
    '--json',
    '--ignore-user-config',
    '--ignore-rules',
    '--ephemeral',
    '--skip-git-repo-check',
    '--sandbox',
    'read-only',
    '--disable',
    'shell_tool',
    '--disable',
    'unified_exec',
    '-c',
    'web_search="disabled"',
    '-c',
    'features.apps=false',
    '-c',
    'features.hooks=false',
    '-c',
    `mcp_servers.pitchcrew.command=${JSON.stringify(context.mcp.command)}`,
    '-c',
    `mcp_servers.pitchcrew.args=${JSON.stringify(context.mcp.args)}`,
    '-c',
    'mcp_servers.pitchcrew.env_vars=["PITCHCREW_RUN_TOKEN","PITCHCREW_DAEMON_URL"]',
    '-',
  ];
  if (context.role.model) args.splice(args.length - 1, 0, '--model', context.role.model);
  if (context.role.reasoning)
    args.splice(
      args.length - 1,
      0,
      '-c',
      `model_reasoning_effort=${JSON.stringify(context.role.reasoning)}`,
    );
  return args;
}
function extract(event: Record<string, unknown>): string | null {
  const item = event.item as { type?: string; text?: string } | undefined;
  if (event.type === 'item.completed' && item?.type === 'agent_message' && item.text)
    return item.text;
  return null;
}
export const codex: RuntimeAdapter = {
  id: 'codex',
  // https://learn.chatgpt.com/docs/models
  models: [
    {
      value: 'gpt-6.1-sol',
      label: 'GPT-6.1 Sol',
      reasoning: { levels: ['low', 'medium', 'high'] },
    },
    {
      value: 'gpt-6-astra',
      label: 'GPT-6 Astra',
      reasoning: { levels: ['low', 'medium', 'high'] },
    },
    { value: 'gpt-6-sol', label: 'GPT-6 Sol', reasoning: { levels: ['low', 'medium', 'high'] } },
    { value: 'gpt-6-luna', label: 'GPT-6 Luna', reasoning: { levels: ['low', 'medium', 'high'] } },
    {
      value: 'gpt-5.6-sol',
      label: 'GPT-5.6 Sol',
      reasoning: { levels: ['low', 'medium', 'high'] },
    },
    {
      value: 'gpt-5.6-terra',
      label: 'GPT-5.6 Terra',
      reasoning: { levels: ['low', 'medium', 'high'] },
    },
    {
      value: 'gpt-5.6-luna',
      label: 'GPT-5.6 Luna',
      reasoning: { levels: ['low', 'medium', 'high'] },
    },
  ],
  detect: () => detectCli('codex', 'codex'),
  listModels: (signal) => readCodexModels('codex', codexModelArgs, signal),
  run: (context) => runCli('codex', argsFor(context), context, promptFor(context), extract),
  chat: (context) => chatCli('codex', argsFor(context), context, extract),
};
