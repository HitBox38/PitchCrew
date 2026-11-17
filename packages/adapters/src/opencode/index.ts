import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { modelListCommand, parseOpenCodeModels } from '../model-discovery.ts';
import { apiModels } from '../models.ts';
import { detectCli, runCliText, withChat } from '../process.ts';

/**
 * OpenCode 2 dropped `--pure`, `--verbose` and `--variant` (a model takes `#variant`) and sends
 * `run` through a shared background service unless `--standalone`. Only a private server applies
 * this run's isolated configuration, so 2.x always runs standalone; older CLIs keep `--pure`.
 * Calendar-style versions (test fixtures) are not OpenCode releases and keep the 1.x flags.
 */
const openCodeTwo = async () => {
  const { version } = await detectCli('opencode', 'opencode');
  const major = Number(version.match(/(\d+)\.\d+\.\d+/)?.[1] ?? 0);
  return major >= 2 && major < 1000;
};

type AgentRule = { action?: unknown; effect?: unknown };
/**
 * The scoped agent must exist and its last wildcard rule must deny, with nothing but Pitchcrew
 * tools allowed after it (OpenCode applies later rules over earlier ones).
 */
export const assertScopedAgent = (text: string) => {
  let agents: { id?: unknown; permissions?: AgentRule[] }[] = [];
  try {
    agents = JSON.parse(text) as typeof agents;
  } catch {
    // Unreadable output is treated like a missing agent below.
  }
  const rules = (Array.isArray(agents) ? agents : []).find(
    (agent) => agent.id === 'pitchcrew',
  )?.permissions;
  const last = rules?.findLastIndex((rule) => rule.action === '*') ?? -1;
  const scoped =
    rules !== undefined &&
    last >= 0 &&
    rules[last].effect === 'deny' &&
    rules
      .slice(last + 1)
      .every((rule) => rule.effect !== 'allow' || String(rule.action).startsWith('pitchcrew_'));
  if (!scoped)
    throw new Error(
      'OpenCode did not apply Pitchcrew’s isolated configuration, so the run was not started. Update OpenCode or choose another runtime in Crew.',
    );
};

export const opencode = withChat({
  applicationIsolation: true,
  customReasoning: true,
  reviewSubagents: { maxConcurrent: 4 },
  id: 'opencode',
  models: apiModels,
  detect: () => detectCli('opencode', 'opencode'),
  listModels: async (signal) =>
    parseOpenCodeModels(
      await modelListCommand(
        'opencode',
        (await openCodeTwo()) ? ['models'] : ['models', '--pure', '--verbose'],
        signal,
      ),
    ),
  launch: async (context, prompt) => {
    if (context.signal.aborted) throw new Error('Run cancelled.');
    const configDirectory = join(context.directory, 'opencode-config');
    await mkdir(configDirectory, { recursive: true });
    const permission = { '*': 'deny', 'pitchcrew_*': 'allow' };
    const config = {
      share: 'disabled',
      autoupdate: false,
      permission,
      agent: {
        pitchcrew: { mode: 'primary', description: 'Scoped Pitchcrew role', permission },
      },
      mcp: {
        pitchcrew: {
          type: 'local',
          command: [context.mcp.command, ...context.mcp.args],
          environment: context.mcp.env,
          enabled: true,
        },
      },
    };
    const two = await openCodeTwo();
    const args = [
      'run',
      two ? '--standalone' : '--pure',
      '--format',
      'json',
      '--agent',
      'pitchcrew',
    ];
    const { model, reasoning } = context.role;
    if (two && model) args.push('--model', reasoning ? `${model}#${reasoning}` : model);
    else {
      if (model) args.push('--model', model);
      if (reasoning) args.push('--variant', reasoning);
    }
    const environment = {
      // Config discovery is isolated; XDG_DATA_HOME is untouched so sign-in stays with OpenCode.
      XDG_CONFIG_HOME: configDirectory,
      OPENCODE_CONFIG_DIR: configDirectory,
      OPENCODE_TEST_HOME: context.directory,
      OPENCODE_CONFIG: '',
      OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
      OPENCODE_PERMISSION: JSON.stringify(permission),
      OPENCODE_DISABLE_PROJECT_CONFIG: 'true',
      OPENCODE_DISABLE_AUTOUPDATE: 'true',
      OPENCODE_AUTO_SHARE: 'false',
      OPENCODE_DISABLE_DEFAULT_PLUGINS: 'false',
    };
    // Fail closed: before a 2.x run, read the private server's effective agents with this exact
    // environment and refuse to start unless the scoped agent ends in deny-all.
    if (two)
      assertScopedAgent(
        await modelListCommand(
          'opencode',
          ['--standalone', 'debug', 'agents'],
          context.signal,
          environment,
        ),
      );
    return runCliText(
      'opencode',
      args,
      context,
      prompt,
      (event) => {
        const part = event.part as { type?: string; text?: string } | undefined;
        return event.type === 'text' && part?.type === 'text' && typeof part.text === 'string'
          ? part.text
          : null;
      },
      environment,
      // OpenCode 2 reports a failed turn (usage limits, unknown models) as an error event on
      // stdout and exits 1 with an empty stderr.
      (event) => {
        if (event.type !== 'error') return null;
        const message = (event.error as { message?: unknown } | undefined)?.message;
        return typeof message === 'string' && message.trim()
          ? `OpenCode: ${message.trim()}`
          : 'OpenCode reported an error without details.';
      },
    );
  },
});
