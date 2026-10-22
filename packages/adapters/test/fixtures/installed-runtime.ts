import { roleResult } from './role-result.ts';

const [command, ...args] = process.argv.slice(2);
const runFixture = async (name: string, prefix: string[] = []) => {
  process.argv = [process.execPath, process.argv[1], ...prefix, ...args];
  await import(`./${name}.ts`);
};
if (command === 'codex' && args.includes('app-server')) {
  await runFixture('models-cli', ['codex']);
} else if (command === 'claude' && args.includes('--input-format')) {
  await runFixture('claude-models-cli', ['default']);
} else if (command === 'copilot' && args.includes('--headless')) {
  await runFixture('models-cli', ['copilot']);
} else if (args.includes('models') || args.includes('--list-models')) {
  const catalogs: Record<string, string> = {
    opencode: 'example/fixture-model',
    'cursor-agent': 'fixture-model - Fixture Model',
    'kiro-cli': JSON.stringify({
      models: [{ model_id: 'fixture-model', model_name: 'Fixture Model' }],
    }),
    grok: 'Available models:\n  * fixture-model (default)',
    pi: 'provider model context max-out thinking images\nexample fixture-model 200K 32K no no',
    omp: JSON.stringify({ models: [{ selector: 'example/fixture-model', name: 'Fixture Model' }] }),
  };
  if (!catalogs[command]) throw new Error(`Missing fixture catalog for ${command}`);
  console.log(catalogs[command]);
} else if (command === 'kiro-cli') {
  await runFixture('acp-cli');
} else if (command === 'claude' || command === 'codex') {
  let prompt = '';
  for await (const chunk of process.stdin) prompt += chunk;
  const reply = roleResult(prompt);
  console.log(
    JSON.stringify(
      command === 'claude'
        ? { type: 'result', result: reply }
        : { type: 'item.completed', item: { type: 'agent_message', text: reply } },
    ),
  );
} else {
  await runFixture('runtime-cli', [command]);
}
