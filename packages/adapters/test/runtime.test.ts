import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardInput, runResultSchema, type RunContext } from '@pitchcrew/core';
import { adapters } from '../src/index.ts';
import { detectCli, runCli } from '../src/process.ts';

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
    runCli: vi.fn((...args: Parameters<typeof actual.runCli>) => {
      const [command, flags, ...rest] = args;
      return actual.runCli(
        process.execPath,
        [fileURLToPath(new URL('./fixtures/runtime-cli.mjs', import.meta.url)), command, ...flags],
        ...rest,
      );
    }),
  };
});

const directories: string[] = [];
async function contextFor(
  runtime: 'gemini-cli' | 'opencode' | 'copilot-cli' | 'cursor-agent',
  mode = '',
): Promise<RunContext> {
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

describe.each(['gemini-cli', 'opencode', 'copilot-cli', 'cursor-agent'] as const)(
  '%s adapter',
  (runtime) => {
    it('detects its executable through the side-effect-free version helper', async () => {
      const command = {
        'gemini-cli': 'gemini',
        opencode: 'opencode',
        'copilot-cli': 'copilot',
        'cursor-agent': 'cursor-agent',
      }[runtime];
      expect(await adapters[runtime].detect()).toMatchObject({ id: runtime, available: true });
      expect(detectCli).toHaveBeenCalledWith(runtime, command);
      expect(runCli).not.toHaveBeenCalled();
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
        expect(
          JSON.parse(request.args[request.args.indexOf('--additional-mcp-config') + 1]),
        ).toEqual({ mcpServers: { pitchcrew: { ...context.mcp, type: 'local', tools: ['*'] } } });
        expect(request.environment.COPILOT_HOME.startsWith(context.directory)).toBe(true);
        expect(
          JSON.parse(
            await readFile(join(request.environment.COPILOT_HOME, 'settings.json'), 'utf8'),
          ),
        ).toEqual({ disableAllHooks: true });
        expect(request.environment.COPILOT_ALLOW_ALL).toBe('false');
        expect(request.environment.GITHUB_COPILOT_PROMPT_MODE_EXTENSIONS).toBe('false');
      } else {
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
      }
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
      expect(runCli).not.toHaveBeenCalled();
    });
  },
);

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
    expect(runCli).not.toHaveBeenCalled();
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
    expect(runCli).not.toHaveBeenCalled();
  });
  it('rejects a failed terminal event even after a valid assistant response', async () => {
    await expect(
      adapters['cursor-agent'].run(await contextFor('cursor-agent', 'terminal-error')),
    ).rejects.toThrow('valid structured result');
  });
});
