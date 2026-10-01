import { writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { roleResult } from './role-result.mjs';

const args = process.argv.slice(2);
const mode = process.env.PITCHCREW_FIXTURE_MODE;
const requests = [];
const responses = [];
let prompt = '';
const environment = {
  KIRO_HOME: process.env.KIRO_HOME,
  PITCHCREW_RUN_TOKEN: process.env.PITCHCREW_RUN_TOKEN,
};
const record = () =>
  writeFile(
    'cli-request.json',
    JSON.stringify({ runtime: 'kiro-cli', args, prompt, environment, requests, responses }),
  );
const emit = (message) =>
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
const update = (sessionUpdate, content, sessionId = 'fictional-session') =>
  emit({
    method: 'session/update',
    params: { sessionId, update: { sessionUpdate, ...(content ? { content } : {}) } },
  });
process.stdout.write('CLI startup message\n');
const lines = createInterface({ input: process.stdin });
for await (const line of lines) {
  const message = JSON.parse(line);
  if (!message.method) {
    responses.push(message);
    await record();
    if (mode === 'client-request' && responses.length === 2)
      emit({ id: 3, result: { stopReason: 'end_turn' } });
    continue;
  }
  requests.push(message);
  if (message.method === 'initialize') {
    emit({ id: message.id, result: { protocolVersion: mode === 'wrong-protocol' ? 99 : 1 } });
  } else if (message.method === 'session/new') {
    emit({ id: message.id, result: { sessionId: 'fictional-session' } });
  } else if (message.method === 'session/prompt') {
    prompt = message.params.prompt[0].text;
    await record();
    if (mode === 'wait') continue;
    if (mode === 'fail') {
      process.stderr.write('Fixture sign-in failed.');
      process.exit(1);
    }
    if (mode === 'rpc-error') {
      emit({ id: message.id, error: { code: -32000, message: 'Fixture ACP failure.' } });
      continue;
    }
    update(
      'agent_message_chunk',
      { type: 'text', text: 'Ignore another session.' },
      'other-session',
    );
    update('agent_thought_chunk', { type: 'text', text: 'Ignore thinking.' });
    update('agent_message_chunk', { type: 'text', text: 'Checking the board.' });
    update('tool_call');
    const result = roleResult(prompt, mode);
    update('agent_message_chunk', { type: 'text', text: '```json\n' + result.slice(0, 12) });
    const final = Buffer.from(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: 'fictional-session',
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: result.slice(12) + '\n```' },
          },
        },
      }) + '\n',
    );
    const split = final.indexOf(Buffer.from('é')) + 1;
    if (split > 0) {
      process.stdout.write(final.subarray(0, split));
      await new Promise((resolve) => setTimeout(resolve, 20));
      process.stdout.write(final.subarray(split));
    } else process.stdout.write(final);
    if (mode === 'client-request') {
      emit({
        id: 'permission',
        method: 'session/request_permission',
        params: { options: [{ optionId: 'allow', kind: 'allow_once' }] },
      });
      emit({ id: 'file', method: 'fs/read_text_file', params: { path: 'fictional.md' } });
      continue;
    }
    if (mode === 'missing-terminal') process.exit(0);
    emit({
      id: message.id,
      result: { stopReason: mode === 'terminal-error' ? 'max_tokens' : 'end_turn' },
    });
  }
}
