import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { modelListCommand, parseOmpModels } from '../model-discovery.ts';
import { apiModels } from '../models.ts';
import { piResultExtractor } from '../pi/result.ts';
import { detectCli, requireCliVersion, runCliText, withChat } from '../process.ts';

export const ohMyPi = withChat({
  id: 'oh-my-pi',
  models: apiModels,
  detect: async () => requireCliVersion(await detectCli('oh-my-pi', 'omp'), [18, 4, 9], 'omp'),
  listModels: async (signal) =>
    parseOmpModels(await modelListCommand('omp', ['models', '--json', '--no-extensions'], signal)),
  async launch(context, prompt) {
    if (context.signal.aborted) throw new Error('Run cancelled.');
    const configRoot = join(context.directory, 'omp-home');
    const agentDir = join(configRoot, 'agent');
    // OMP joins PI_CONFIG_DIR to the native home; an absolute value would be misresolved.
    const configDir = relative(homedir(), configRoot);
    if (isAbsolute(configDir))
      throw new Error('OMP run directories must be on the same drive as the user home.');
    await mkdir(agentDir, { recursive: true });
    // JSON is a YAML subset accepted by OMP's native config.yml reader.
    await writeFile(
      join(agentDir, 'config.yml'),
      JSON.stringify({
        disabledProviders: [
          'agent-plugins',
          'agents-md',
          'claude-md',
          'agents',
          'claude',
          'claude-plugins',
          'cline',
          'codex',
          'cursor',
          'gemini',
          'github',
          'mcp-json',
          'omp-plugins',
          'opencode',
          'skillshare',
          'ssh-json',
          'vscode',
          'windsurf',
          'builtin-defaults',
        ],
        enabledProviders: [],
        mcp: { enableProjectConfig: false, startupTimeoutMs: 0 },
        advisor: { enabled: false },
        autolearn: { enabled: false },
        memory: { backend: 'off' },
        goal: { enabled: false },
        compaction: { experimentalContextManagement: false },
      }),
      { mode: 0o600 },
    );
    await writeFile(
      join(agentDir, 'mcp.json'),
      JSON.stringify({ mcpServers: { pitchcrew: { type: 'stdio', ...context.mcp } } }),
      { mode: 0o600 },
    );
    const args = [
      '--print',
      '--mode',
      'json',
      '--no-session',
      '--no-tools',
      '--tools',
      [
        'get_card',
        'read_profile',
        'read_chat_attachment',
        'get_history',
        'lint_packet',
        'get_packet_rules',
        'export_packet',
        ...(context.role.capabilities?.computerUse
          ? ['computer_inspect', 'computer_request', 'computer_execute']
          : []),
      ]
        .map((name) => `mcp__pitchcrew_${name}`)
        .join(','),
      '--no-extensions',
      '--no-skills',
      '--no-rules',
      '--no-lsp',
      '--no-pty',
      '--no-title',
      '--no-prewalk',
    ];
    if (context.role.model) args.push('--model', context.role.model);
    if (context.role.reasoning) args.push('--thinking', context.role.reasoning);
    return runCliText('omp', args, context, prompt, piResultExtractor(), {
      PI_CODING_AGENT_DIR: agentDir,
      PI_CONFIG_DIR: configDir,
      XDG_DATA_HOME: join(configRoot, 'data'),
      XDG_STATE_HOME: join(configRoot, 'state'),
      XDG_CACHE_HOME: join(configRoot, 'cache'),
      OMP_PROFILE: '',
      PI_PROFILE: '',
      PI_NO_TITLE: '1',
      OMP_MCP_REQUIRE_READY: '1',
      OMP_MCP_STARTUP_TIMEOUT_MS: '0',
      OMP_MCP_TIMEOUT_MS: '30000',
    });
  },
});
