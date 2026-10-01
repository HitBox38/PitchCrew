import type { RuntimeAdapter, RunContext, ChatContext } from '@pitchcrew/core';
import { detectCli, promptFor, runCli, chatCli } from '../process.ts';
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
  detect: () => detectCli('codex', 'codex'),
  run: (context) => runCli('codex', argsFor(context), context, promptFor(context), extract),
  chat: (context) => chatCli('codex', argsFor(context), context, extract),
};
