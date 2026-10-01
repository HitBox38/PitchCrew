import { writeFile } from 'node:fs/promises';

const [runtime, ...args] = process.argv.slice(2);
let prompt = '';
for await (const chunk of process.stdin) prompt += chunk;
const environment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      ['GEMINI_CLI_SYSTEM_SETTINGS_PATH', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME'].includes(key) ||
      key.startsWith('OPENCODE_') ||
      key.startsWith('PITCHCREW_'),
  ),
);
await writeFile('cli-request.json', JSON.stringify({ runtime, args, prompt, environment }));
const mode = process.env.PITCHCREW_FIXTURE_MODE;
if (mode === 'wait') {
  setInterval(() => {}, 1000);
} else if (mode === 'fail') {
  process.stderr.write('Fixture sign-in failed.');
  process.exitCode = 1;
} else {
  const role = prompt.match(/You are Pitchcrew's (scout|writer|reviewer)/)?.[1];
  const packet = {
    resume: '# Fictional Candidate\n- Built café interfaces.',
    coverLetter: 'Built café interfaces.',
    formAnswers: '',
    note: '',
    claims: [
      { claim: 'Built café interfaces.', source: 'profile.md', quote: 'Built café interfaces.' },
    ],
  };
  const result =
    mode === 'wrong-role'
      ? { role: 'reviewer', passed: true, feedback: [] }
      : role === 'writer'
        ? { role, packet }
        : role === 'reviewer'
          ? { role, passed: true, feedback: [] }
          : { role: 'scout', fit: 87, reasons: ['Fixture result'] };
  const text = mode === 'invalid' ? 'This is not JSON.' : JSON.stringify(result);
  const emit = (event) => process.stdout.write(JSON.stringify(event) + '\n');
  process.stdout.write('CLI startup message\n');
  if (runtime === 'gemini') {
    emit({ type: 'init', session_id: 'fictional-session' });
    emit({ type: 'message', role: 'user', content: 'Ignore me.' });
    emit({ type: 'message', role: 'assistant', content: 'Checking the board.', delta: true });
    emit({ type: 'tool_use', tool_name: 'pitchcrew_card' });
    emit({ type: 'tool_result', output: 'Not an assistant answer.' });
    // Split events across stdout writes, as a real pipe can.
    const first = Buffer.from(
      JSON.stringify({
        type: 'message',
        role: 'assistant',
        content: '```json\n' + text.slice(0, 12),
        delta: true,
      }) + '\n',
    );
    process.stdout.write(first.subarray(0, 23));
    process.stdout.write(first.subarray(23));
    const final = Buffer.from(
      JSON.stringify({
        type: 'message',
        role: 'assistant',
        content: text.slice(12) + '\n```',
        delta: true,
      }) + '\n',
    );
    const split = final.indexOf(Buffer.from('é')) + 1;
    if (split > 0) {
      process.stdout.write(final.subarray(0, split));
      await new Promise((resolve) => setTimeout(resolve, 20));
      process.stdout.write(final.subarray(split));
    } else process.stdout.write(final);
    process.stdout.write(JSON.stringify({ type: 'result', status: 'success', stats: {} }));
  } else {
    emit({ type: 'step_start', part: { type: 'step-start' } });
    emit({ type: 'tool_use', part: { type: 'tool', output: 'Ignore me.' } });
    emit({ type: 'text', part: { type: 'text', text: 'Checking the board.' } });
    // A complete event without a trailing newline must still be parsed.
    process.stdout.write(JSON.stringify({ type: 'text', part: { type: 'text', text } }));
  }
}
