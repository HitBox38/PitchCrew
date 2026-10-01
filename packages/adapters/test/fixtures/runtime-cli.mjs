import { readFile, writeFile } from 'node:fs/promises';

import { roleResult } from './role-result.mjs';

const [runtime, ...args] = process.argv.slice(2);
let prompt = '';
for await (const chunk of process.stdin) prompt += chunk;
if (runtime === 'goose') {
  const promptPath = args[args.indexOf('--params') + 1].slice('pitchcrew_prompt='.length);
  prompt = JSON.parse('"' + (await readFile(promptPath, 'utf8')) + '"');
}
const environment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      [
        'GEMINI_CLI_SYSTEM_SETTINGS_PATH',
        'XDG_CONFIG_HOME',
        'XDG_DATA_HOME',
        'CURSOR_CONFIG_DIR',
        'COPILOT_HOME',
        'GOOSE_PATH_ROOT',
        'GOOSE_ADDITIONAL_CONFIG_FILES',
        'GOOSE_MODE',
        'GOOSE_SYSTEM_PROMPT_FILE_PATH',
        'COPILOT_ALLOW_ALL',
        'GITHUB_COPILOT_PROMPT_MODE_EXTENSIONS',
      ].includes(key) ||
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
  const text = roleResult(prompt, mode);
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
  } else if (runtime === 'goose') {
    emit({
      type: 'message',
      message: { role: 'user', content: [{ type: 'text', text: 'Ignore me.' }] },
    });
    emit({
      type: 'message',
      message: { role: 'assistant', content: [{ type: 'text', text: 'Checking the board.' }] },
    });
    emit({
      type: 'message',
      message: {
        role: 'assistant',
        content: [{ type: 'toolRequest', toolCall: { name: 'pitchcrew_get_card' } }],
      },
    });
    emit({
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'Ignore me.' },
          { type: 'text', text: text.slice(0, 12) },
        ],
      },
    });
    emit({
      type: 'message',
      message: { role: 'assistant', content: [{ type: 'text', text: text.slice(12) }] },
    });
    if (mode === 'missing-terminal') process.exit(0);
    emit({ type: 'complete', total_tokens: 0 });
    if (mode === 'terminal-error') emit({ type: 'error', error: 'Fixture terminal failure.' });
  } else if (runtime === 'copilot') {
    emit({ type: 'assistant.message_delta', data: { deltaContent: 'Ignore me.' } });
    emit({ type: 'tool.execution_complete', data: { result: 'Ignore me.' } });
    process.stdout.write(JSON.stringify({ type: 'assistant.message', data: { content: text } }));
  } else if (runtime === 'cursor-agent') {
    emit({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
    emit({ type: 'tool_call', subtype: 'completed', tool_call: { result: 'Ignore me.' } });
    process.stdout.write(
      JSON.stringify(
        mode === 'terminal-error'
          ? { type: 'result', subtype: 'error', is_error: true, result: text }
          : { type: 'result', subtype: 'success', is_error: false, result: text },
      ),
    );
  } else {
    emit({ type: 'step_start', part: { type: 'step-start' } });
    emit({ type: 'tool_use', part: { type: 'tool', output: 'Ignore me.' } });
    emit({ type: 'text', part: { type: 'text', text: 'Checking the board.' } });
    // A complete event without a trailing newline must still be parsed.
    process.stdout.write(JSON.stringify({ type: 'text', part: { type: 'text', text } }));
  }
}
