import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { detectCli, withChat, runCliText } from '../process.ts';
import { apiModels } from '../models.ts';

export const goose = withChat({
  id: 'goose',
  // These suggestions use only providers allowed by the scoped Goose launcher.
  models: apiModels,
  detect: () => detectCli('goose', 'goose'),
  async launch(context, prompt) {
    if (context.signal.aborted) throw new Error('Run cancelled.');
    const separator = context.role.model.indexOf('/');
    const qualified = separator > 0 && separator < context.role.model.length - 1;
    const provider = qualified
      ? context.role.model.slice(0, separator)
      : process.env.GOOSE_PROVIDER;
    // Native CLI/ACP providers can execute their own tools outside the recipe's extension list.
    if (!provider || !['openai', 'anthropic', 'google', 'ollama', 'openrouter'].includes(provider))
      throw new Error(
        'Choose a Goose provider/model using openai, anthropic, google, ollama or openrouter, or set GOOSE_PROVIDER to one of these providers before starting Pitchcrew.',
      );
    const pathRoot = join(context.directory, 'goose-home');
    await mkdir(pathRoot, { recursive: true });
    const recipePath = join(context.directory, 'goose-recipe.json');
    const promptPath = join(context.directory, 'goose-prompt.txt');
    // Recipe templates are rendered before JSON decoding. Encode the file parameter for
    // its JSON string slot so job/profile text is never compiled as template source.
    await writeFile(promptPath, JSON.stringify(prompt).slice(1, -1), { mode: 0o600 });
    await writeFile(
      recipePath,
      JSON.stringify({
        version: '1.0.0',
        title: 'Pitchcrew role',
        description: 'One scoped Pitchcrew run',
        prompt: '{{ pitchcrew_prompt }}',
        parameters: [
          {
            key: 'pitchcrew_prompt',
            input_type: 'file',
            requirement: 'required',
            description: 'Scoped Pitchcrew prompt',
          },
        ],
        // An explicit recipe extension list replaces all default/platform extensions.
        extensions: [
          {
            type: 'stdio',
            name: 'pitchcrew',
            cmd: context.mcp.command,
            args: context.mcp.args,
            envs: context.mcp.env,
            env_keys: [],
            timeout: 60,
          },
        ],
      }),
      { mode: 0o600 },
    );
    const args = [
      'run',
      '--no-session',
      '--recipe',
      recipePath,
      '--params',
      `pitchcrew_prompt=${promptPath}`,
      '--output-format',
      'stream-json',
      '--quiet',
      '--provider',
      provider,
    ];
    if (context.role.model) {
      args.push(
        '--model',
        qualified ? context.role.model.slice(separator + 1) : context.role.model,
      );
    }
    let assistant = '',
      failed = false;
    return runCliText(
      'goose',
      args,
      context,
      '',
      (event) => {
        if (event.type === 'error') failed = true;
        const message = event.message as
          | { role?: string; content?: { type?: string; text?: string }[] }
          | undefined;
        if (
          event.type === 'message' &&
          message?.role === 'assistant' &&
          Array.isArray(message.content)
        ) {
          if (message.content.some((part) => part.type === 'toolRequest')) assistant = '';
          else
            assistant += message.content
              .filter((part) => part.type === 'text' && typeof part.text === 'string')
              .map((part) => part.text)
              .join('');
        }
        if (failed) return 'Goose run failed.';
        return event.type === 'complete'
          ? assistant || 'Goose returned no assistant answer.'
          : null;
      },
      {
        // Native keyring/environment authentication remains owned by Goose.
        GOOSE_PATH_ROOT: pathRoot,
        GOOSE_ADDITIONAL_CONFIG_FILES: '',
        GOOSE_MODE: 'auto',
        GOOSE_DISABLE_SESSION_NAMING: 'true',
        GOOSE_DISABLE_TOOL_CALL_SUMMARY: 'true',
        GOOSE_SYSTEM_PROMPT_FILE_PATH: undefined,
      },
    );
  },
});
