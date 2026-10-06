import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { apiModels } from '../models.ts';
import { detectCli, requireCliVersion, runCliText, withChat } from '../process.ts';

// Native API providers only: ACP/agent CLI providers may expose their own tools.
const providers = ['openrouter', 'anthropic', 'openai-api', 'gemini', 'nous', 'xai', 'lmstudio'];

export const hermes = withChat({
  id: 'hermes',
  // OpenRouter keeps the vendor/model selector intact after the Hermes provider prefix.
  models: apiModels.map((model) => ({ ...model, value: `openrouter:${model.value}` })),
  detect: async () => requireCliVersion(await detectCli('hermes', 'hermes'), [0, 21, 5], 'hermes'),
  async launch(context, prompt) {
    if (context.signal.aborted) throw new Error('Run cancelled.');
    const separator = context.role.model.indexOf(':');
    const provider =
      separator >= 0
        ? context.role.model.slice(0, separator)
        : process.env.HERMES_INFERENCE_PROVIDER || 'openrouter';
    const model = separator >= 0 ? context.role.model.slice(separator + 1) : context.role.model;
    if (!providers.includes(provider) || (separator >= 0 && !model) || model.includes(':'))
      throw new Error(
        'Choose a Hermes provider:model using openrouter, anthropic, openai-api, gemini, nous, xai or lmstudio, or set HERMES_INFERENCE_PROVIDER to one of these providers before starting Pitchcrew.',
      );
    const home = join(context.directory, 'hermes-home');
    await mkdir(home, { recursive: true });
    // JSON is valid YAML. Never import the user's config, plugins, auth files or memory.
    await writeFile(
      join(home, 'config.yaml'),
      JSON.stringify({
        model: { provider, openai_runtime: 'auto' },
        toolsets: ['pitchcrew'],
        mcp_servers: { pitchcrew: context.mcp },
        mcp: { auto_reload_on_config_change: false },
        plugins: { enabled: [], auto_update_check_hours: 0 },
        auth: { adopt_external_logins: false },
        memory: { memory_enabled: false, user_profile_enabled: false, provider: '' },
        skills: { external_dirs: [], project_discovery: false, auto_load: [], inline_shell: false },
        auxiliary: { background_review: { enabled: false } },
        fallback_providers: [],
        hooks: {},
      }),
      { mode: 0o600 },
    );
    const args = [
      'chat',
      '--query-file',
      '-',
      '--oneshot',
      '--format',
      'stream-json',
      '--ignore-rules',
      '--toolsets',
      'pitchcrew',
      '--provider',
      provider,
    ];
    if (model) args.push('--model', model);
    let failed = false;
    return runCliText(
      'hermes',
      args,
      context,
      prompt,
      (event) => {
        if (
          event.type === 'error' ||
          (event.type === 'result' && (event.exit_code !== 0 || event.error))
        )
          failed = true;
        if (failed) return 'Hermes did not complete its turn.';
        return event.type === 'result' && typeof event.text === 'string'
          ? event.text || 'Hermes returned no assistant answer.'
          : null;
      },
      {
        // Clear ambient Hermes controls; provider API keys remain in the native environment.
        ...Object.fromEntries(
          Object.keys(process.env)
            .filter((key) => key.startsWith('HERMES_'))
            .map((key) => [key, undefined]),
        ),
        HERMES_HOME: home,
        HERMES_ENABLE_PROJECT_PLUGINS: '0',
        HERMES_IGNORE_RULES: '1',
        HERMES_DISABLE_FAST_CHAT_LAUNCH: '1',
      },
    );
  },
});
