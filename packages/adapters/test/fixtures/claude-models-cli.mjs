import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';

const mode = process.argv[2];
const args = process.argv.slice(3);
assert.equal(realpathSync(process.cwd()), realpathSync(tmpdir()));
assert.equal(process.env.PITCHCREW_GOOGLE_CLIENT_SECRET, undefined);
for (const flag of [
  '-p',
  '--safe-mode',
  '--restricted',
  '--strict-mcp-config',
  '--no-session-persistence',
])
  assert.ok(args.includes(flag));
const valueFor = (flag) => args[args.indexOf(flag) + 1];
assert.equal(valueFor('--input-format'), 'stream-json');
assert.equal(valueFor('--output-format'), 'stream-json');
assert.equal(valueFor('--tools'), '');
assert.equal(valueFor('--setting-sources'), '');
assert.deepEqual(JSON.parse(valueFor('--mcp-config')), { mcpServers: {} });
assert.deepEqual(JSON.parse(valueFor('--settings')), { disableAllHooks: true });

const rl = createInterface({ input: process.stdin });
const send = (value) => process.stdout.write(JSON.stringify(value) + '\n');
let requestId;
const respond = () => {
  const models =
    mode === 'empty'
      ? []
      : [
          {
            value: 'default',
            displayName: 'Default (recommended)',
            resolvedModel: 'fixture-model',
          },
          {
            value: 'fixture-model',
            displayName: 'Fixture · Model',
            supportsEffort: true,
            supportedEffortLevels: ['low', 'high', 'fixture-private-effort'],
            description: 'fixture-private-metadata',
          },
          { value: 'fixture-model', displayName: 'Fixture · Model' },
        ];
  const response =
    mode === 'invalid'
      ? { models: [{}] }
      : mode === 'missing'
        ? {}
        : {
            models,
            account: { email: 'fixture-private-account' },
            commands: [{ name: 'fixture-private-command' }],
          };
  const output =
    JSON.stringify({
      type: 'control_response',
      response: {
        subtype: mode === 'error' ? 'error' : 'success',
        request_id: requestId,
        response,
        error: mode === 'error' ? 'fixture-private-error' : undefined,
      },
    }) + '\n';
  process.stdout.write(output.slice(0, 19));
  setTimeout(() => process.stdout.write(output.slice(19)), 5);
};
rl.on('line', (line) => {
  const message = JSON.parse(line);
  if (requestId) {
    assert.equal(mode, 'control');
    assert.deepEqual(message, {
      type: 'control_response',
      response: {
        subtype: 'error',
        request_id: 'unexpected-action',
        error: 'Model discovery does not support this request.',
      },
    });
    respond();
    return;
  }
  // Any user message, model switch, sign-in or inference request fails the contract.
  assert.equal(message.type, 'control_request');
  assert.deepEqual(message.request, { subtype: 'initialize' });
  assert.equal(typeof message.request_id, 'string');
  requestId = message.request_id;
  if (mode === 'exit') process.exit(0);
  if (mode === 'hang' || mode === 'stubborn') {
    if (mode === 'stubborn') process.on('SIGTERM', () => {});
    setInterval(() => {}, 1000);
    return;
  }
  if (mode === 'oversized' || mode === 'stderr') {
    (mode === 'stderr' ? process.stderr : process.stdout).write('x'.repeat(3_000_000));
    return;
  }
  console.log('fixture startup diagnostic');
  console.log('null');
  send({ type: 'control_response', response: { subtype: 'error', request_id: 'other-request' } });
  if (mode === 'control') {
    send({
      type: 'control_request',
      request_id: 'unexpected-action',
      request: { subtype: 'can_use_tool' },
    });
  } else respond();
});
