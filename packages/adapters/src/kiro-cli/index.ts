import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { detectCli, withChat } from '../process.ts';
import { runAcpText } from '../acp.ts';

export const kiroCli = withChat({
  id: 'kiro-cli',
  detect: () => detectCli('kiro-cli', 'kiro-cli'),
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
