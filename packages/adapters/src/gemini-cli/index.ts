import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RuntimeAdapter } from '@pitchcrew/core';
import { detectCli, promptFor, runCli } from '../process.ts';

export const geminiCli: RuntimeAdapter = {
  id: 'gemini-cli',
  detect: () => detectCli('gemini-cli', 'gemini'),
  async run(context) {
    if (context.signal.aborted) throw new Error('Run cancelled.');
    const settingsPath = join(context.directory, 'gemini-settings.json');
    // System settings take precedence over user/project settings without moving CLI credentials.
    await writeFile(
      settingsPath,
      JSON.stringify({
        tools: { core: [], discoveryCommand: '', callCommand: '' },
        mcp: { allowed: ['pitchcrew'], serverCommand: '' },
        mcpServers: { pitchcrew: { ...context.mcp, trust: true } },
        hooksConfig: { enabled: false },
        skills: { enabled: false },
        security: { folderTrust: { enabled: false } },
        advanced: { ignoreLocalEnv: true },
        context: { fileName: 'AGENTS.md' },
        telemetry: { enabled: false },
      }),
      { encoding: 'utf8', mode: 0o600 },
    );
    const args = [
      '--output-format',
      'stream-json',
      '--approval-mode',
      'default',
      '--extensions',
      'none',
      '--allowed-mcp-server-names',
      'pitchcrew',
    ];
    if (context.role.model) args.push('--model', context.role.model);
    let response = '';
    return runCli(
      'gemini',
      args,
      context,
      promptFor(context),
      (event) => {
        // Discard assistant commentary before a tool call; the next turn is the final candidate.
        if (event.type === 'tool_use') response = '';
        if (
          event.type !== 'message' ||
          event.role !== 'assistant' ||
          typeof event.content !== 'string'
        )
          return null;
        response = event.delta === true ? response + event.content : event.content;
        return response;
      },
      { GEMINI_CLI_SYSTEM_SETTINGS_PATH: settingsPath },
    );
  },
};
