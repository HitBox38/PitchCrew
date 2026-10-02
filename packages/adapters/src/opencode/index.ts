import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { detectCli, withChat, runCliText } from '../process.ts';
import { apiModels } from '../models.ts';
import { modelListCommand, parseOpenCodeModels } from '../model-discovery.ts';

export const opencode = withChat({
  id: 'opencode',
  models: apiModels,
  detect: () => detectCli('opencode', 'opencode'),
  listModels: async (signal) =>
    parseOpenCodeModels(await modelListCommand('opencode', ['models', '--pure'], signal)),
  async launch(context, prompt) {
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
    const args = ['run', '--pure', '--format', 'json', '--agent', 'pitchcrew'];
    if (context.role.model) args.push('--model', context.role.model);
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
      {
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
      },
    );
  },
});
