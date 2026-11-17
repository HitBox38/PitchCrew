import { writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { roleResult } from './role-result.ts';

const args = process.argv.slice(2);
const mode = process.env.PITCHCREW_FIXTURE_MODE;
const requests: unknown[] = [];
const responses: unknown[] = [];
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
const emit = (message: Record<string, unknown>) =>
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
const update = (
  sessionUpdate: string,
  content?: { type: string; text: string },
  sessionId = 'fictional-session',
  fields: Record<string, unknown> = {},
) =>
  emit({
    method: 'session/update',
    params: { sessionId, update: { sessionUpdate, ...(content ? { content } : {}), ...fields } },
  });
const toolUpdate = (sessionUpdate: string, fields: Record<string, unknown>) =>
  update(sessionUpdate, undefined, 'fictional-session', fields);
const textContent = (text: string) => [{ type: 'content', content: { type: 'text', text } }];
/** A Pitchcrew call as Kiro's v2 engine starts it: its identity sits in `_meta.kiro`. */
const v2Call = (toolCallId: string, tool: string, rawInput: Record<string, unknown>) =>
  toolUpdate('tool_call', {
    toolCallId,
    title: `Running: @pitchcrew/${tool}`,
    kind: 'other',
    status: 'pending',
    rawInput,
    _meta: { kiro: { toolName: tool, mcpServerName: 'pitchcrew' } },
  });
// A Pitchcrew call the daemon records, one that failed before reaching it, and a native call
// whose command and failure repeat the run token; then the same Pitchcrew outcomes in Kiro's v2
// shapes, including a refusal the daemon records itself.
const toolCalls = () => {
  toolUpdate('tool_call', {
    toolCallId: 'tool-1',
    title: '@pitchcrew/pitchcrew_get_card',
    kind: 'other',
    status: 'pending',
    rawInput: { cardId: 'PRIVATE_ARG' },
  });
  toolUpdate('tool_call_update', { toolCallId: 'tool-1', status: 'in_progress' });
  toolUpdate('tool_call_update', {
    toolCallId: 'tool-1',
    status: 'completed',
    content: textContent('{"card":"PRIVATE_ARG"}'),
  });
  toolUpdate('tool_call', {
    toolCallId: 'tool-2',
    title: '@pitchcrew/pitchcrew_save_memory',
    status: 'in_progress',
    rawInput: { text: 'PRIVATE_ARG' },
  });
  toolUpdate('tool_call_update', {
    toolCallId: 'tool-2',
    status: 'failed',
    content: textContent(
      'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_save_memory: text is required',
    ),
    _meta: { kiro: { failureReason: 'error' } },
  });
  toolUpdate('tool_call', {
    toolCallId: 'tool-3',
    title: 'Run command',
    kind: 'execute',
    status: 'in_progress',
    rawInput: { command: `echo ${process.env.PITCHCREW_RUN_TOKEN}` },
  });
  toolUpdate('tool_call_update', {
    toolCallId: 'tool-3',
    status: 'failed',
    content: textContent(`Command failed: ${process.env.PITCHCREW_RUN_TOKEN} was rejected`),
    _meta: { kiro: { failureReason: 'error' } },
  });
  v2Call('tool-4', 'pitchcrew_get_card', { cardId: 'PRIVATE_ARG' });
  toolUpdate('tool_call_update', { toolCallId: 'tool-4', status: 'in_progress' });
  toolUpdate('tool_call_update', {
    toolCallId: 'tool-4',
    status: 'completed',
    content: textContent('{"card":"PRIVATE_ARG"}'),
  });
  v2Call('tool-5', 'pitchcrew_computer_execute', { text: 'PRIVATE_ARG' });
  toolUpdate('tool_call_update', { toolCallId: 'tool-5', status: 'in_progress' });
  toolUpdate('tool_call_update', {
    toolCallId: 'tool-5',
    status: 'failed',
    content: textContent('locator.fill: Timeout 5000ms exceeded. Typing "PRIVATE_ARG"'),
  });
  v2Call('tool-6', 'pitchcrew_recall_memory', { query: 'PRIVATE_ARG' });
  toolUpdate('tool_call_update', {
    toolCallId: 'tool-6',
    status: 'failed',
    content: textContent(
      'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_recall_memory: query is required',
    ),
  });
};
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
    if (mode === 'tool-calls') toolCalls();
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
