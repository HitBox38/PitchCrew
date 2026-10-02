import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { detectCli, runCliText, withChat } from '../process.ts';
import { copilotModelArgs, readCopilotModels } from './models.ts';

export const copilotCli = withChat({
  id: 'copilot-cli',
  // https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#supported-models
  models: [
    { value: 'auto', label: 'Auto' },
    { value: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
    { value: 'claude-opus-5.5', label: 'Claude Opus 5.5' },
    { value: 'claude-haiku-4.5', label: 'Claude Haiku 4.5' },
    { value: 'gpt-6-astra', label: 'GPT-6 Astra' },
    { value: 'gpt-6-sol', label: 'GPT-6 Sol' },
    { value: 'gpt-6-luna', label: 'GPT-6 Luna' },
    { value: 'gpt-5.4', label: 'GPT-5.4' },
    { value: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
    { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
  ],
  detect: () => detectCli('copilot-cli', 'copilot'),
  listModels: (signal) => readCopilotModels('copilot', copilotModelArgs, signal),
  async launch(context, prompt) {
    if (context.signal.aborted) throw new Error('Run cancelled.');
    const configDirectory = join(context.directory, 'copilot-config');
    await mkdir(configDirectory, { recursive: true });
    await writeFile(
      join(configDirectory, 'settings.json'),
      JSON.stringify({ disableAllHooks: true }),
      { mode: 0o600 },
    );
    const args = [
      '--output-format',
      'json',
      '--available-tools',
      'pitchcrew/*',
      '--allow-tool',
      'pitchcrew',
      '--deny-tool',
      'shell,write,read,url,memory',
      '--disable-builtin-mcps',
      '--additional-mcp-config',
      JSON.stringify({
        mcpServers: { pitchcrew: { ...context.mcp, type: 'local', tools: ['*'] } },
      }),
      '--mode',
      'interactive',
      '--no-ask-user',
      '--no-auto-update',
      '--no-bash-env',
      '--no-custom-instructions',
      '--no-experimental',
      '--no-remote',
      '--no-remote-export',
      '--log-level',
      'none',
      '--secret-env-vars',
      'PITCHCREW_RUN_TOKEN',
    ];
    if (context.role.model) args.push('--model', context.role.model);
    return runCliText(
      'copilot',
      args,
      context,
      prompt,
      (event) => {
        const data = event.data as { content?: string } | undefined;
        return event.type === 'assistant.message' && typeof data?.content === 'string'
          ? data.content
          : null;
      },
      {
        // Keep native keychain/environment authentication; never import config-file tokens.
        COPILOT_HOME: configDirectory,
        COPILOT_ALLOW_ALL: 'false',
        COPILOT_AUTO_UPDATE: 'false',
        COPILOT_SKILLS_DIRS: '',
        COPILOT_CUSTOM_INSTRUCTIONS_DIRS: '',
        COPILOT_MCP_TOOL_CACHE: 'false',
        COPILOT_ENABLE_INTERRUPTED_SESSION_RESTORE: '0',
        GITHUB_COPILOT_PROMPT_MODE_EXTENSIONS: 'false',
        GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS: 'false',
      },
    );
  },
});
