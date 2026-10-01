import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RuntimeAdapter } from '@pitchcrew/core';
import { detectCli, promptFor, runCli } from '../process.ts';

export const copilotCli: RuntimeAdapter = {
  id: 'copilot-cli',
  detect: () => detectCli('copilot-cli', 'copilot'),
  async run(context) {
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
    return runCli(
      'copilot',
      args,
      context,
      promptFor(context),
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
};
