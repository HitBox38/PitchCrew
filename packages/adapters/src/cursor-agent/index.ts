import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RuntimeHealth } from '@pitchcrew/core';
import { detectCli, withChat, runCliText } from '../process.ts';
import { modelListCommand, parseCursorModels } from '../model-discovery.ts';

async function detectCursorAgent(): Promise<RuntimeHealth> {
  const health = await detectCli('cursor-agent', 'cursor-agent');
  if (!health.available) return health;
  const version = health.version.match(/\d{4}\.\d{2}\.\d{2}/)?.[0];
  if (!version || version < '2026.09.26') {
    return {
      ...health,
      available: false,
      detail:
        'Cursor Agent 2026.09.26 or newer is required for isolated MCP configuration. Upgrade cursor-agent and retry.',
    };
  }
  return health;
}

export const cursorAgent = withChat({
  id: 'cursor-agent',
  // Cursor's model IDs include its own reasoning presets, unlike other CLIs.
  // https://cursor.com/docs/cli/reference/parameters (--list-models)
  models: [
    { value: 'auto', label: 'Auto' },
    { value: 'composer-2.5', label: 'Composer 2.5' },
    { value: 'composer-2.5-fast', label: 'Composer 2.5 Fast' },
    { value: 'claude-sonnet-5-5-medium', label: 'Claude Sonnet 5.5 Medium' },
    { value: 'claude-opus-5-5-medium', label: 'Claude Opus 5.5 Medium' },
    { value: 'gpt-5.6-sol-high', label: 'GPT-5.6 Sol High' },
    { value: 'gpt-5.6-luna-high', label: 'GPT-5.6 Luna High' },
    { value: 'gemini-3.7-flash-high', label: 'Gemini 3.7 Flash High' },
    { value: 'grok-4.7-medium', label: 'Grok 4.7 Medium' },
  ],
  detect: detectCursorAgent,
  listModels: async (signal) =>
    parseCursorModels(await modelListCommand('cursor-agent', ['--list-models'], signal)),
  async launch(context, prompt) {
    if (context.signal.aborted) throw new Error('Run cancelled.');
    const health = await detectCursorAgent();
    if (!health.available) throw new Error(health.detail);
    const configDirectory = join(context.directory, 'cursor-config');
    const projectDirectory = join(context.directory, '.cursor');
    await mkdir(configDirectory, { recursive: true });
    await mkdir(projectDirectory, { recursive: true });
    const permissions = {
      allow: ['Mcp(pitchcrew:*)'],
      deny: ['Shell(*)', 'Read(**)', 'Write(**)', 'WebFetch(*)'],
    };
    await writeFile(
      join(configDirectory, 'cli-config.json'),
      JSON.stringify({
        version: 1,
        editor: { vimMode: false },
        approvalMode: 'allowlist',
        permissions,
      }),
      { mode: 0o600 },
    );
    await writeFile(join(projectDirectory, 'cli.json'), JSON.stringify({ permissions }), {
      mode: 0o600,
    });
    await writeFile(
      join(projectDirectory, 'mcp.json'),
      JSON.stringify({ mcpServers: { pitchcrew: context.mcp } }),
      { mode: 0o600 },
    );
    const args = [
      '--print',
      '--output-format',
      'stream-json',
      '--trust',
      '--approve-mcps',
      '--workspace',
      context.directory,
    ];
    if (context.role.model) args.push('--model', context.role.model);
    return runCliText(
      'cursor-agent',
      args,
      context,
      prompt,
      (event) => {
        // Intermediate assistant messages are not a completed run.
        if (event.type !== 'result') return null;
        return event.subtype === 'success' &&
          event.is_error === false &&
          typeof event.result === 'string'
          ? event.result
          : 'Invalid Cursor terminal result.';
      },
      {
        // Authentication remains in the native credential store/data directory.
        CURSOR_CONFIG_DIR: configDirectory,
      },
    );
  },
});
