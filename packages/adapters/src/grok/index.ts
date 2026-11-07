import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, parse } from 'node:path';
import { modelDiscoveryTimeout, modelListCommand, parseGrokModels } from '../model-discovery.ts';
import {
  detectCli,
  requireCliVersion,
  runCliText,
  runtimeTimeLimit,
  withChat,
} from '../process.ts';
import type { RunContext } from '@pitchcrew/core';
import { withWorkspaceGrokCredentials } from '../process/auth-credentials.ts';
import { watchRuntimeDeadline } from '../process/deadline.ts';

const grokEnvironment = (home?: string): Record<string, string | undefined> => ({
  GROK_HOME: home,
  GROK_AUTH: undefined,
  GROK_CONFIG: undefined,
  GROK_CONFIG_PATH: undefined,
  GROK_AGENT: undefined,
  GROK_DISABLE_AUTOUPDATER: '1',
  GROK_MEMORY: '0',
  GROK_SUBAGENTS: '0',
  ...Object.fromEntries(
    ['CLAUDE', 'CURSOR'].flatMap((vendor) =>
      ['SKILLS', 'RULES', 'AGENTS', 'MCPS', 'HOOKS'].map((feature) => [
        `GROK_${vendor}_${feature}_ENABLED`,
        '0',
      ]),
    ),
  ),
});

const writeConfiguration = async (home: string, directory: string, mcp?: RunContext['mcp']) => {
  await mkdir(home, { recursive: true, mode: 0o700 });
  // Only generated scoped configuration is present, never the login home's configuration.
  await writeFile(
    join(home, 'config.toml'),
    [
      '[claude_compat]',
      'imported = true',
      '[skills]',
      `ignore = ${JSON.stringify([...new Set([parse(homedir()).root, parse(directory).root, parse(home).root])])}`,
      '[cli]',
      'auto_update = false',
      '[telemetry]',
      'trace_upload = false',
      '[session]',
      'load_envrc = false',
      '[memory]',
      'enabled = false',
      '[subagents]',
      'enabled = false',
      ...(mcp
        ? [
            '[mcp_servers.pitchcrew]',
            `command = ${JSON.stringify(mcp.command)}`,
            `args = ${JSON.stringify(mcp.args)}`,
            ...Object.entries(mcp.env).map(
              ([key, value]) => `env.${JSON.stringify(key)} = ${JSON.stringify(value)}`,
            ),
          ]
        : []),
    ].join('\n') + '\n',
    { mode: 0o600 },
  );
};

export const grok = withChat({
  id: 'grok',
  // https://docs.x.ai/build/settings
  models: [
    { value: 'grok-build', label: 'Grok Build' },
    { value: 'grok-4.7', label: 'Grok 4.7' },
  ],
  detect: async () => requireCliVersion(await detectCli('grok', 'grok'), [1, 0, 45], 'grok'),
  listModels: async (signal) => {
    const boundedSignal = AbortSignal.any([
      ...(signal ? [signal] : []),
      AbortSignal.timeout(modelDiscoveryTimeout),
    ]);
    return withWorkspaceGrokCredentials(undefined, boundedSignal, async (home) => {
      if (home) await writeConfiguration(home, home);
      return parseGrokModels(
        await modelListCommand(
          'grok',
          ['--no-auto-update', 'models'],
          boundedSignal,
          grokEnvironment(home),
        ),
      );
    });
  },
  launch: async (context, prompt) => {
    if (context.signal.aborted) throw new Error('Run cancelled.');
    const deadlineController = new AbortController();
    const launchContext = {
      ...context,
      deadline: context.deadline ?? { expiresAt: Date.now() + runtimeTimeLimit },
      signal: AbortSignal.any([context.signal, deadlineController.signal]),
    };
    let timedOut = false;
    const stopDeadline = watchRuntimeDeadline(launchContext, () => {
      timedOut = true;
      deadlineController.abort();
    });
    try {
      return await withWorkspaceGrokCredentials(
        join(context.directory, 'grok-home'),
        launchContext.signal,
        async (selectedHome) => {
          const grokHome = selectedHome!;
          const promptPath = join(context.directory, 'grok-prompt.txt');
          await writeFile(promptPath, prompt, { mode: 0o600 });
          await writeConfiguration(grokHome, context.directory, context.mcp);
          // Local Grok exposes MCP through these two helpers; clamp every other built-in/hosted tool.
          const args = [
            '--no-auto-update',
            '--prompt-file',
            promptPath,
            '--verbatim',
            '--output-format',
            'streaming-json',
            '--tools',
            'GrokBuild:search_tool,GrokBuild:use_tool',
            '--allow',
            'MCPTool(pitchcrew__*)',
            '--deny',
            'Read(**)',
            '--permission-mode',
            'dontAsk',
            '--no-subagents',
            '--no-plan',
            '--no-memory',
            '--disable-web-search',
          ];
          if (context.role.model) args.push('--model', context.role.model);
          let assistant = '',
            failed = false;
          return runCliText(
            'grok',
            args,
            launchContext,
            '',
            (event) => {
              if (event.type === 'tool_call') assistant = '';
              if (event.type === 'text' && typeof event.data === 'string') assistant += event.data;
              if (event.type === 'error' || event.type === 'max_turns_reached') failed = true;
              if (event.type === 'end' && event.stopReason !== 'end_turn') failed = true;
              if (failed) return 'Grok did not complete its turn.';
              return event.type === 'end'
                ? assistant || 'Grok returned no assistant answer.'
                : null;
            },
            grokEnvironment(grokHome),
          );
        },
      );
    } catch (error) {
      if (timedOut && !context.signal.aborted)
        throw Object.assign(
          new Error(
            `Pitchcrew stopped the runtime after its ${runtimeTimeLimit / 60000}-minute limit.`,
          ),
          { code: 'ETIMEDOUT' },
        );
      throw error;
    } finally {
      stopDeadline();
    }
  },
});
