import type { RuntimeAdapter } from '@pitchcrew/core';
import { detectCli, promptFor, runCli } from '../process.ts';
export const claudeCode: RuntimeAdapter = {
  id: 'claude-code',
  detect: () => detectCli('claude-code', 'claude'),
  async run(context) {
    const args = [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
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
    return runCli('claude', args, context, promptFor(context), (event) => {
      if (event.type === 'result' && typeof event.result === 'string') return event.result;
      return null;
    });
  },
};
