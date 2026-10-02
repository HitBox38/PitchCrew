import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { detectCli, withChat } from '../process.ts';
import { runAcpText } from '../acp.ts';
import { modelListCommand, parseKiroModels } from '../model-discovery.ts';

export const kiroCli = withChat({
  id: 'kiro-cli',
  // https://kiro.dev/docs/models/
  models: [
    { value: 'auto', label: 'Auto' },
    { value: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
    { value: 'claude-opus-4.6', label: 'Claude Opus 4.6' },
    { value: 'claude-haiku-4.5', label: 'Claude Haiku 4.5' },
  ],
  detect: () => detectCli('kiro-cli', 'kiro-cli'),
  listModels: async (signal) =>
    parseKiroModels(
      await modelListCommand('kiro-cli', ['chat', '--list-models', '--format', 'json'], signal),
    ),
  async launch(context, prompt) {
    if (context.signal.aborted) throw new Error('Run cancelled.');
    const kiroHome = join(context.directory, 'kiro-home');
    const agentsDirectory = join(kiroHome, 'agents');
    await mkdir(agentsDirectory, { recursive: true });
    await writeFile(
      join(agentsDirectory, 'pitchcrew.json'),
      JSON.stringify({
        name: 'pitchcrew',
        description: 'Scoped Pitchcrew role',
        tools: ['@pitchcrew/*'],
        allowedTools: ['@pitchcrew/*'],
        mcpServers: { pitchcrew: context.mcp },
        includeMcpJson: false,
        includePowers: false,
        resources: [],
        hooks: {},
      }),
      { mode: 0o600 },
    );
    const args = [
      'acp',
      '--agent-engine',
      'v2',
      '--agent',
      'pitchcrew',
      '--trust-tools',
      '@pitchcrew/*',
    ];
    if (context.role.model) args.push('--model', context.role.model);
    return runAcpText('kiro-cli', args, context, prompt, {
      // Headless authentication uses the CLI's KIRO_API_KEY environment, never copied here.
      KIRO_HOME: kiroHome,
      KIRO_CHAT_LOG_FILE: join(kiroHome, 'runtime.log'),
      KIRO_LOG_NO_COLOR: '1',
    });
  },
});
