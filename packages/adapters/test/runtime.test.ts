import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardInput, runResultSchema, type RunContext } from '@pitchcrew/core';
import { adapters } from '../src/index.ts';
import { runAcp, runAcpText } from '../src/acp.ts';
import { detectCli, runCliText } from '../src/process.ts';

// Keep the subprocess runner real; replace only the provider executable with a fictional fixture.
vi.mock('../src/process.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/process.ts')>();
  return {
    ...actual,
    detectCli: vi.fn(async (id, command) => ({
      id,
      available: true,
      version: '2026.09.26-fixture',
      detail: command,
    })),
    runCliText: vi.fn((...args: Parameters<typeof actual.runCliText>) => {
      const [command, flags, ...rest] = args;
      return actual.runCliText(
        process.execPath,
        [fileURLToPath(new URL('./fixtures/runtime-cli.mjs', import.meta.url)), command, ...flags],
        ...rest,
      );
    }),
  };
});

vi.mock('../src/acp.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/acp.ts')>();
  return {
    ...actual,
    runAcp: vi.fn((...args: Parameters<typeof actual.runAcp>) => {
      const [, flags, ...rest] = args;
      return actual.runAcp(
        process.execPath,
        [fileURLToPath(new URL('./fixtures/acp-cli.mjs', import.meta.url)), ...flags],
        ...rest,
      );
    }),
    runAcpText: vi.fn((...args: Parameters<typeof actual.runAcpText>) => {
      const [, flags, ...rest] = args;
      return actual.runAcpText(
        process.execPath,
        [fileURLToPath(new URL('./fixtures/acp-cli.mjs', import.meta.url)), ...flags],
        ...rest,
      );
    }),
  };
});

const directories: string[] = [];
async function contextFor(
  runtime:
    | 'gemini-cli'
    | 'opencode'
    | 'copilot-cli'
    | 'cursor-agent'
    | 'goose'
    | 'kiro-cli'
    | 'grok'
    | 'pi'
    | 'oh-my-pi',
  mode = '',
): Promise<RunContext> {
  if (runtime === 'goose') vi.stubEnv('GOOSE_PROVIDER', 'openai');
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-adapter-'));
  directories.push(directory);
  return {
    card: {
      ...cardInput.parse({ company: 'Fixture', title: 'Engineer' }),
      id: 'fixture',
      state: 'lead',
      fit: null,
      owner: null,
      packet: null,
      feedback: [],
      createdAt: '',
      updatedAt: '',
      sample: true,
    },
    role: {
      id: 'scout',
      name: 'Scout',
      description: 'Fixture',
      runtime,
      model: '',
      enabled: true,
      instructions: 'Evaluate the fictional opportunity.',
    },
    profile: [{ name: 'profile.md', content: '# Fictional Candidate\n- Built café interfaces.' }],
    directory,
    mcp: {
      command: process.execPath,
      args: ['fixture-mcp.ts'],
      env: {
        PITCHCREW_RUN_TOKEN: 'fictional-token',
        PITCHCREW_DAEMON_URL: 'http://127.0.0.1:1',
        PITCHCREW_FIXTURE_MODE: mode,
      },
    },
    signal: new AbortController().signal,
    onMessage: vi.fn(),
  };
}
async function requestFor(context: RunContext) {
  return JSON.parse(await readFile(join(context.directory, 'cli-request.json'), 'utf8')) as {
    runtime: string;
    args: string[];
    prompt: string;
    environment: Record<string, string>;
  };
}
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) {
    if (!resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-adapter-')))
      throw new Error('Refusing unsafe cleanup target.');
    await rm(directory, { recursive: true, force: true });
  }
});

describe.each([
  'gemini-cli',
  'opencode',
  'copilot-cli',
  'cursor-agent',
  'goose',
  'kiro-cli',
  'grok',
  'pi',
  'oh-my-pi',
] as const)('%s adapter', (runtime) => {
  it('detects its executable through the side-effect-free version helper', async () => {
    const command = {
      'gemini-cli': 'gemini',
      opencode: 'opencode',
      'copilot-cli': 'copilot',
      'cursor-agent': 'cursor-agent',
      goose: 'goose',
      'kiro-cli': 'kiro-cli',
      grok: 'grok',
      pi: 'pi',
      'oh-my-pi': 'omp',
    }[runtime];
    expect(await adapters[runtime].detect()).toMatchObject({ id: runtime, available: true });
    expect(detectCli).toHaveBeenCalledWith(runtime, command);
    expect(runCliText).not.toHaveBeenCalled();
    expect(runAcp).not.toHaveBeenCalled();
    expect(runAcpText).not.toHaveBeenCalled();
  });
  it('normalizes provider events and passes the model, prompt and scoped MCP configuration', async () => {
    const context = await contextFor(runtime);
    context.role.model = runtime === 'opencode' ? 'example/fixture-model' : 'fixture-model';
    expect(await adapters[runtime].run(context)).toEqual({
      role: 'scout',
      fit: 87,
      reasons: ['Fixture result'],
    });
    const request = await requestFor(context);
    expect(request.args).toContain(context.role.model);
    expect(request.prompt).toContain(context.role.instructions);
    expect(request.prompt).toContain(context.profile[0].content.replaceAll('\n', '\\n'));
    expect(request.environment.PITCHCREW_RUN_TOKEN).toBe('fictional-token');
    if (runtime === 'gemini-cli') {
      expect(request.args).toEqual([
        '--output-format',
        'stream-json',
        '--approval-mode',
        'default',
        '--extensions',
        'none',
        '--allowed-mcp-server-names',
        'pitchcrew',
        '--model',
        'fixture-model',
      ]);
      const settings = JSON.parse(
        await readFile(request.environment.GEMINI_CLI_SYSTEM_SETTINGS_PATH, 'utf8'),
      );
      expect(settings.tools).toEqual({ core: [], discoveryCommand: '', callCommand: '' });
      expect(settings.mcp.allowed).toEqual(['pitchcrew']);
      expect(settings.mcpServers).toEqual({ pitchcrew: { ...context.mcp, trust: true } });
      expect(settings.hooksConfig.enabled).toBe(false);
      expect(settings.skills.enabled).toBe(false);
    } else if (runtime === 'opencode') {
      expect(request.args).toEqual([
        'run',
        '--pure',
        '--format',
        'json',
        '--agent',
        'pitchcrew',
        '--model',
        'example/fixture-model',
      ]);
      const config = JSON.parse(request.environment.OPENCODE_CONFIG_CONTENT);
      expect(config.permission).toEqual({ '*': 'deny', 'pitchcrew_*': 'allow' });
      expect(config.agent.pitchcrew.permission).toEqual(config.permission);
      expect(config.mcp).toEqual({
        pitchcrew: {
          type: 'local',
          command: [context.mcp.command, ...context.mcp.args],
          environment: context.mcp.env,
          enabled: true,
        },
      });
      expect(config.share).toBe('disabled');
      expect(request.environment.OPENCODE_AUTO_SHARE).toBe('false');
      expect(request.environment.OPENCODE_DISABLE_PROJECT_CONFIG).toBe('true');
      expect(request.environment.XDG_CONFIG_HOME.startsWith(context.directory)).toBe(true);
      expect(request.environment.OPENCODE_TEST_HOME).toBe(context.directory);
      expect(request.environment.XDG_DATA_HOME).toBe(process.env.XDG_DATA_HOME);
    } else if (runtime === 'copilot-cli') {
      expect(request.args).toContain('--no-remote-export');
      expect(request.args).toContain('--disable-builtin-mcps');
      expect(request.args).not.toContain('--allow-all');
      expect(request.args[request.args.indexOf('--available-tools') + 1]).toBe('pitchcrew/*');
      expect(request.args[request.args.indexOf('--allow-tool') + 1]).toBe('pitchcrew');
      expect(request.args[request.args.indexOf('--deny-tool') + 1]).toBe(
        'shell,write,read,url,memory',
      );
      expect(JSON.parse(request.args[request.args.indexOf('--additional-mcp-config') + 1])).toEqual(
        { mcpServers: { pitchcrew: { ...context.mcp, type: 'local', tools: ['*'] } } },
      );
      expect(request.environment.COPILOT_HOME.startsWith(context.directory)).toBe(true);
      expect(
        JSON.parse(await readFile(join(request.environment.COPILOT_HOME, 'settings.json'), 'utf8')),
      ).toEqual({ disableAllHooks: true });
      expect(request.environment.COPILOT_ALLOW_ALL).toBe('false');
      expect(request.environment.GITHUB_COPILOT_PROMPT_MODE_EXTENSIONS).toBe('false');
    } else if (runtime === 'cursor-agent') {
      expect(request.args).toContain('--print');
      expect(request.args).not.toContain('--force');
      expect(request.args).not.toContain('--yolo');
      expect(request.args).not.toContain('--auto-review');
      expect(request.args[request.args.indexOf('--workspace') + 1]).toBe(context.directory);
      const config = JSON.parse(
        await readFile(join(request.environment.CURSOR_CONFIG_DIR, 'cli-config.json'), 'utf8'),
      );
      expect(config.approvalMode).toBe('allowlist');
      expect(config.permissions).toEqual({
        allow: ['Mcp(pitchcrew:*)'],
        deny: ['Shell(*)', 'Read(**)', 'Write(**)', 'WebFetch(*)'],
      });
      expect(
        JSON.parse(await readFile(join(context.directory, '.cursor', 'cli.json'), 'utf8')),
      ).toEqual({ permissions: config.permissions });
      expect(
        JSON.parse(await readFile(join(context.directory, '.cursor', 'mcp.json'), 'utf8')),
      ).toEqual({ mcpServers: { pitchcrew: context.mcp } });
      expect(request.environment.XDG_CONFIG_HOME).toBe(process.env.XDG_CONFIG_HOME);
    } else if (runtime === 'goose') {
      expect(request.args).toContain('--no-session');
      expect(request.args).not.toContain('--no-profile');
      expect(request.environment.GOOSE_PATH_ROOT.startsWith(context.directory)).toBe(true);
      expect(request.environment.GOOSE_ADDITIONAL_CONFIG_FILES).toBe('');
      expect(request.environment.GOOSE_SYSTEM_PROMPT_FILE_PATH).toBeUndefined();
      const recipe = JSON.parse(
        await readFile(request.args[request.args.indexOf('--recipe') + 1], 'utf8'),
      );
      expect(recipe.prompt).toBe('{{ pitchcrew_prompt }}');
      expect(recipe.parameters).toEqual([
        {
          key: 'pitchcrew_prompt',
          input_type: 'file',
          requirement: 'required',
          description: 'Scoped Pitchcrew prompt',
        },
      ]);
      expect(recipe.extensions).toEqual([
        {
          type: 'stdio',
          name: 'pitchcrew',
          cmd: context.mcp.command,
          args: context.mcp.args,
          envs: context.mcp.env,
          env_keys: [],
          timeout: 60,
        },
      ]);
    } else if (runtime === 'grok') {
      expect(request.args).toContain('--no-auto-update');
      expect(request.args).toContain('--verbatim');
      expect(request.args).not.toContain('--always-approve');
      expect(request.args[request.args.indexOf('--tools') + 1].split(',')).toEqual([
        'GrokBuild:search_tool',
        'GrokBuild:use_tool',
      ]);
      expect(request.args[request.args.indexOf('--allow') + 1]).toBe('MCPTool(pitchcrew__*)');
      expect(request.args[request.args.indexOf('--permission-mode') + 1]).toBe('dontAsk');
      expect(request.args[request.args.indexOf('--deny') + 1]).toBe('Read(**)');
      const home = request.environment.GROK_HOME;
      expect(home.startsWith(context.directory)).toBe(true);
      const config = await readFile(join(home, 'config.toml'), 'utf8');
      expect(config).toContain(`command = ${JSON.stringify(context.mcp.command)}`);
      expect(config).toContain(`args = ${JSON.stringify(context.mcp.args)}`);
      expect(config).toContain('trace_upload = false');
      expect(config).toContain('[claude_compat]\nimported = true');
      expect(config).toContain('[skills]\nignore = ');
      expect(request.environment.GROK_CONFIG).toBeUndefined();
      expect(request.environment.GROK_CONFIG_PATH).toBeUndefined();
      for (const vendor of ['CLAUDE', 'CURSOR'])
        for (const feature of ['SKILLS', 'RULES', 'AGENTS', 'MCPS', 'HOOKS'])
          expect(request.environment[`GROK_${vendor}_${feature}_ENABLED`]).toBe('0');
    } else if (runtime === 'pi') {
      expect(request.args).toContain('--no-session');
      expect(request.args).toContain('--no-builtin-tools');
      expect(request.args).not.toContain('--no-tools');
      expect(request.args).toContain('--no-extensions');
      expect(request.args[request.args.indexOf('--extension') + 1]).toBe('builtin:mcp');
      expect(request.args).toContain('--no-context-files');
      expect(request.args).toContain('--no-approve');
      expect(request.environment.PI_CODING_AGENT_DIR.startsWith(context.directory)).toBe(true);
      const config = JSON.parse(
        await readFile(join(request.environment.PI_CODING_AGENT_DIR, 'mcp.json'), 'utf8'),
      );
      expect(config).toEqual({
        autoEnableCodemode: false,
        mcpServers: { pitchcrew: { ...context.mcp, exposure: 'direct' } },
      });
    } else if (runtime === 'oh-my-pi') {
      expect(request.args).toContain('--no-session');
      expect(request.args).toContain('--no-tools');
      expect(request.args).toContain('--no-extensions');
      expect(request.args).toContain('--no-title');
      expect(request.args).not.toContain('--yolo');
      expect(request.args[request.args.indexOf('--tools') + 1].split(',')).toEqual([
        'mcp__pitchcrew_get_card',
        'mcp__pitchcrew_read_profile',
        'mcp__pitchcrew_get_history',
        'mcp__pitchcrew_lint_packet',
        'mcp__pitchcrew_export_packet',
      ]);
      const home = request.environment.PI_CODING_AGENT_DIR;
      expect(home.startsWith(context.directory)).toBe(true);
      expect(resolve(homedir(), request.environment.PI_CONFIG_DIR)).toBe(
        join(context.directory, 'omp-home'),
      );
      expect(request.environment.OMP_PROFILE).toBe('');
      expect(request.environment.PI_PROFILE).toBe('');
      expect(request.environment.OMP_MCP_REQUIRE_READY).toBe('1');
      const settings = JSON.parse(await readFile(join(home, 'config.yml'), 'utf8'));
      expect(settings.mcp.enableProjectConfig).toBe(false);
      expect(settings.autolearn.enabled).toBe(false);
      expect(settings.memory.backend).toBe('off');
      expect(settings.goal.enabled).toBe(false);
      expect(settings.compaction.experimentalContextManagement).toBe(false);
      for (const key of ['XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME'])
        expect(request.environment[key].startsWith(context.directory)).toBe(true);
      expect(settings.disabledProviders).toEqual(
        expect.arrayContaining([
          'claude',
          'codex',
          'cursor',
          'gemini',
          'mcp-json',
          'agent-plugins',
          'omp-plugins',
        ]),
      );
      expect(settings.disabledProviders).not.toContain('native');
      expect(JSON.parse(await readFile(join(home, 'mcp.json'), 'utf8'))).toEqual({
        mcpServers: { pitchcrew: { type: 'stdio', ...context.mcp } },
      });
    } else {
      expect(request.args).toContain('acp');
      expect(request.args).not.toContain('--trust-all-tools');
      expect(request.args[request.args.indexOf('--trust-tools') + 1]).toBe('@pitchcrew/*');
      const agent = JSON.parse(
        await readFile(join(request.environment.KIRO_HOME, 'agents', 'pitchcrew.json'), 'utf8'),
      );
      expect(agent.tools).toEqual(['@pitchcrew/*']);
      expect(agent.allowedTools).toEqual(agent.tools);
      expect(agent.mcpServers).toEqual({ pitchcrew: context.mcp });
      expect(agent.includeMcpJson).toBe(false);
      expect(agent.includePowers).toBe(false);
      expect(agent.hooks).toEqual({});
      expect(agent.resources).toEqual([]);
    }
  });
  it.each([false, true])('returns a chat reply with an attached card: %s', async (attached) => {
    const context = await contextFor(runtime);
    const chat = {
      ...context,
      card: attached ? context.card : null,
      request: 'Fictional current request',
      messages: [],
    };
    expect(await adapters[runtime].chat(chat)).toEqual({
      reply: 'Fixture conversational café response.',
    });
    const request = await requestFor(context);
    expect(request.prompt).toContain('Fictional current request');
    expect(request.prompt).toContain(`Attached card: ${JSON.stringify(chat.card)}`);
    expect(request.environment.PITCHCREW_RUN_TOKEN).toBe('fictional-token');
  });
  it('rejects workflow-shaped or malformed chat responses', async () => {
    for (const mode of ['wrong-role', 'invalid']) {
      const context = await contextFor(runtime, mode);
      await expect(
        adapters[runtime].chat({ ...context, card: null, messages: [] }),
      ).rejects.toThrow();
    }
  });
  it('filters connector OAuth configuration from its launch environment', async () => {
    vi.stubEnv('PITCHCREW_GOOGLE_CLIENT_SECRET', 'fictional-connector-secret');
    const context = await contextFor(runtime);
    await adapters[runtime].run(context);
    expect((await requestFor(context)).environment.PITCHCREW_GOOGLE_CLIENT_SECRET).toBeUndefined();
  });
  it('uses the CLI default when no model is configured', async () => {
    const context = await contextFor(runtime);
    await adapters[runtime].run(context);
    expect((await requestFor(context)).args).not.toContain('--model');
  });
  it.each(['writer', 'reviewer'] as const)(
    'returns validated %s results with source quotes intact',
    async (role) => {
      const context = await contextFor(runtime);
      context.role.id = role;
      const result = await adapters[runtime].run(context);
      expect(runResultSchema.parse(result).role).toBe(role);
      if (result.role === 'writer') {
        expect(result.packet.claims[0].quote).toBe('Built café interfaces.');
        expect(context.profile[0].content).toContain(result.packet.claims[0].quote);
      }
    },
  );
  it.each(['invalid', 'wrong-role'])('rejects a %s result', async (mode) => {
    await expect(adapters[runtime].run(await contextFor(runtime, mode))).rejects.toThrow(
      'valid structured result',
    );
  });
  it('propagates subprocess failures', async () => {
    await expect(adapters[runtime].run(await contextFor(runtime, 'fail'))).rejects.toThrow(
      'Fixture sign-in failed',
    );
  });
  it('cancels an active subprocess', async () => {
    const context = await contextFor(runtime, 'wait');
    const controller = new AbortController();
    context.signal = controller.signal;
    const result = adapters[runtime].run(context);
    const rejected = expect(result).rejects.toThrow('Run cancelled');
    await vi.waitFor(async () => expect((await requestFor(context)).runtime).toBeDefined());
    controller.abort();
    await rejected;
  });
  it('does not launch a subprocess for an already cancelled run', async () => {
    const context = await contextFor(runtime);
    context.signal = AbortSignal.abort();
    await expect(adapters[runtime].run(context)).rejects.toThrow('Run cancelled');
    expect(runCliText).not.toHaveBeenCalled();
    expect(runAcp).not.toHaveBeenCalled();
  });
});

describe('Cursor completion and isolation', () => {
  it('reports an installed but unsupported CLI as unavailable with upgrade instructions', async () => {
    vi.mocked(detectCli).mockResolvedValueOnce({
      id: 'cursor-agent',
      available: true,
      version: '2026.07.17-fixture',
      detail: '',
    });
    expect(await adapters['cursor-agent'].detect()).toMatchObject({
      available: false,
      detail: expect.stringContaining('Upgrade cursor-agent'),
    });
    expect(runCliText).not.toHaveBeenCalled();
  });
  it('rejects older CLI builds before starting a provider run', async () => {
    vi.mocked(detectCli).mockResolvedValueOnce({
      id: 'cursor-agent',
      available: true,
      version: '2026.07.17-fixture',
      detail: '',
    });
    await expect(adapters['cursor-agent'].run(await contextFor('cursor-agent'))).rejects.toThrow(
      '2026.09.26 or newer',
    );
    expect(runCliText).not.toHaveBeenCalled();
  });
  it('rejects a failed terminal event even after a valid assistant response', async () => {
    await expect(
      adapters['cursor-agent'].run(await contextFor('cursor-agent', 'terminal-error')),
    ).rejects.toThrow('valid structured result');
  });
});

describe('Goose completion and provider selection', () => {
  it('preserves template-like untrusted text literally in the prompt', async () => {
    const context = await contextFor('goose');
    context.card.description = 'Fictional job: {{ 7 * 7 }} {% include "marker.txt" %}';
    await adapters.goose.run(context);
    expect((await requestFor(context)).prompt).toContain('{{ 7 * 7 }} {% include');
  });
  it.each([
    'claude-code',
    'gemini-cli',
    'codex',
    'claude-acp',
    'codex-acp',
    'custom-cli',
    undefined,
  ])('rejects unsupported provider %s before starting a process', async (provider) => {
    const context = await contextFor('goose');
    vi.stubEnv('GOOSE_PROVIDER', provider);
    await expect(adapters.goose.run(context)).rejects.toThrow('Choose a Goose provider/model');
    expect(runCliText).not.toHaveBeenCalled();
  });
  it('rejects a CLI provider in the model setting even with an API environment default', async () => {
    const context = await contextFor('goose');
    context.role.model = 'claude-code/fixture-model';
    await expect(adapters.goose.run(context)).rejects.toThrow('Choose a Goose provider/model');
    expect(runCliText).not.toHaveBeenCalled();
  });
  it('accepts provider/model while preserving model names that contain slashes', async () => {
    const context = await contextFor('goose');
    context.role.model = 'openrouter/example/fixture-model';
    await adapters.goose.run(context);
    const request = await requestFor(context);
    expect(request.args.slice(-4)).toEqual([
      '--provider',
      'openrouter',
      '--model',
      'example/fixture-model',
    ]);
  });
  it.each(['terminal-error', 'missing-terminal'])(
    'rejects %s after assistant output',
    async (mode) => {
      await expect(adapters.goose.run(await contextFor('goose', mode))).rejects.toThrow(
        'valid structured result',
      );
    },
  );
});

describe('Kiro ACP boundary', () => {
  it.each(['terminal-error', 'missing-terminal', 'rpc-error', 'wrong-protocol'])(
    'rejects %s without accepting an incomplete turn',
    async (mode) => {
      await expect(adapters['kiro-cli'].run(await contextFor('kiro-cli', mode))).rejects.toThrow();
    },
  );
  it('starts exactly one fresh session, disables client capabilities and cancels permission requests', async () => {
    const context = await contextFor('kiro-cli', 'client-request');
    expect((await adapters['kiro-cli'].run(context)).role).toBe('scout');
    const request = (await requestFor(context)) as Awaited<ReturnType<typeof requestFor>> & {
      requests: { method: string; params: Record<string, unknown> }[];
      responses: { id: string; result?: unknown; error?: unknown }[];
    };
    expect(request.requests.map((r) => r.method)).toEqual([
      'initialize',
      'session/new',
      'session/prompt',
    ]);
    expect(request.requests[0].params.clientCapabilities).toEqual({
      fs: { readTextFile: false, writeTextFile: false },
      terminal: false,
    });
    expect(request.requests[1].params).toEqual({ cwd: context.directory, mcpServers: [] });
    expect(request.responses).toContainEqual({
      jsonrpc: '2.0',
      id: 'permission',
      result: { outcome: { outcome: 'cancelled' } },
    });
    expect(request.responses).toContainEqual({
      jsonrpc: '2.0',
      id: 'file',
      error: { code: -32601, message: 'Pitchcrew does not provide this client capability.' },
    });
  });
});

describe.each(['grok', 'pi', 'oh-my-pi'] as const)('%s terminal validation', (runtime) => {
  it.each(['terminal-error', 'missing-terminal', 'late-error'])(
    'rejects %s after a valid assistant message',
    async (mode) => {
      await expect(adapters[runtime].run(await contextFor(runtime, mode))).rejects.toThrow(
        'valid structured result',
      );
    },
  );
});
describe.each(['pi', 'oh-my-pi'] as const)('%s native agent completion', (runtime) => {
  it.each(['truncated', 'empty-terminal'])('rejects %s agent_end output', async (mode) => {
    await expect(adapters[runtime].run(await contextFor(runtime, mode))).rejects.toThrow(
      'valid structured result',
    );
  });
});
it('rejects Grok max-turns exhaustion even if the CLI subsequently emits end_turn', async () => {
  await expect(adapters.grok.run(await contextFor('grok', 'max-turns'))).rejects.toThrow(
    'valid structured result',
  );
});
