import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { detectCli, withChat, requireCliVersion, runCliText } from '../process.ts';
import { piResultExtractor } from './result.ts';
import { apiModels } from '../models.ts';
import { modelListCommand, parsePiModels } from '../model-discovery.ts';

export const pi = withChat({
  id: 'pi',
  models: apiModels,
  detect: async () => requireCliVersion(await detectCli('pi', 'pi'), [1, 0, 0], 'pi'),
  listModels: async (signal) =>
    parsePiModels(
      await modelListCommand(
        'pi',
        ['--list-models', '--no-extensions', '--no-skills', '--no-context-files', '--no-session'],
        signal,
      ),
    ),
  async launch(context, prompt) {
    if (context.signal.aborted) throw new Error('Run cancelled.');
    const agentDir = join(context.directory, 'pi-home');
    await mkdir(agentDir, { recursive: true });
    await writeFile(
      join(agentDir, 'mcp.json'),
      JSON.stringify({
        autoEnableCodemode: false,
        mcpServers: { pitchcrew: { ...context.mcp, exposure: 'direct' } },
      }),
      { mode: 0o600 },
    );
    const args = [
      '--print',
      '--mode',
      'json',
      '--no-session',
      '--no-builtin-tools',
      '--no-extensions',
      '--extension',
      'builtin:mcp',
      '--no-skills',
      '--no-prompt-templates',
      '--no-themes',
      '--no-context-files',
      '--no-approve',
      '--offline',
    ];
    if (context.role.model) args.push('--model', context.role.model);
    return runCliText('pi', args, context, prompt, piResultExtractor(), {
      PI_CODING_AGENT_DIR: agentDir,
      PI_CODING_AGENT_SESSION_DIR: join(agentDir, 'sessions'),
      PI_OFFLINE: '1',
    });
  },
});
