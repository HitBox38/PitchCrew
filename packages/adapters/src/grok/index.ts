import { mkdir, writeFile } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { homedir } from 'node:os';
import { detectCli, withChat, requireCliVersion, runCliText } from '../process.ts';

export const grok = withChat({
  id: 'grok',
  detect: async () => requireCliVersion(await detectCli('grok', 'grok'), [1, 0, 45], 'grok'),
  async launch(context, prompt) {
    if (context.signal.aborted) throw new Error('Run cancelled.');
    const grokHome = join(context.directory, 'grok-home');
    const promptPath = join(context.directory, 'grok-prompt.txt');
    await mkdir(grokHome, { recursive: true });
    await writeFile(promptPath, prompt, { mode: 0o600 });
    // JSON strings and arrays are valid TOML basic strings/arrays for these generated fields.
    await writeFile(
      join(grokHome, 'config.toml'),
      [
        // The native import marker also prevents automatic Claude plugin activation.
        '[claude_compat]',
        'imported = true',
        '[skills]',
        `ignore = ${JSON.stringify([...new Set([parse(homedir()).root, parse(context.directory).root])])}`,
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
        '[mcp_servers.pitchcrew]',
        `command = ${JSON.stringify(context.mcp.command)}`,
        `args = ${JSON.stringify(context.mcp.args)}`,
        ...Object.entries(context.mcp.env).map(
          ([key, value]) => `env.${JSON.stringify(key)} = ${JSON.stringify(value)}`,
        ),
      ].join('\n') + '\n',
      { mode: 0o600 },
    );
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
      context,
      '',
      (event) => {
        if (event.type === 'tool_call') assistant = '';
        if (event.type === 'text' && typeof event.data === 'string') assistant += event.data;
        if (event.type === 'error' || event.type === 'max_turns_reached') failed = true;
        if (event.type === 'end' && event.stopReason !== 'end_turn') failed = true;
        if (failed) return 'Grok did not complete its turn.';
        return event.type === 'end' ? assistant || 'Grok returned no assistant answer.' : null;
      },
      {
        GROK_HOME: grokHome,
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
      },
    );
  },
});
