import { createInterface } from 'node:readline';

const mode = process.argv[2];
if (process.env.PITCHCREW_GOOGLE_CLIENT_SECRET) process.exit(1);
if (mode === 'cursor') {
  console.log(
    '\u001b[1mAvailable models\u001b[0m\nauto - Auto (default)\nfixture-high - Fixture High\n',
  );
} else if (mode === 'oversized') {
  process.stdout.write('x'.repeat(3_000_000));
} else if (mode === 'hang') {
  setInterval(() => {}, 1000);
} else if (mode === 'fail') {
  console.error('fixture-private-diagnostic');
  process.exit(1);
} else if (mode.startsWith('copilot')) {
  let buffer = Buffer.alloc(0);
  let connected = false;
  const send = (value) => {
    const body = JSON.stringify({ jsonrpc: '2.0', ...value });
    const frame = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
    const bytes = Buffer.from(frame);
    process.stdout.write(bytes.subarray(0, 18));
    setTimeout(() => process.stdout.write(bytes.subarray(18)), 5);
  };
  process.stdin.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const end = buffer.indexOf('\r\n\r\n');
      if (end < 0) return;
      const length = Number(
        buffer
          .subarray(0, end)
          .toString()
          .match(/Content-Length: (\d+)/)[1],
      );
      if (buffer.length < end + 4 + length) return;
      const message = JSON.parse(buffer.subarray(end + 4, end + 4 + length).toString());
      buffer = buffer.subarray(end + 4 + length);
      if (message.method === 'connect' && mode === 'copilot-legacy')
        send({ id: message.id, error: { code: -32601 } });
      else if (message.method === 'connect' || message.method === 'ping') {
        connected = true;
        send({ id: message.id, result: { protocolVersion: 3 } });
      } else if (message.method === 'models.list' && connected) {
        if (mode === 'copilot-hang') continue;
        if (mode === 'copilot-invalid') {
          send({ id: message.id, result: { models: [{}] } });
          continue;
        }
        send({
          id: message.id,
          result: {
            models: [
              {
                id: 'fixture-live',
                name: 'Fixture · Live',
                policy: { state: 'enabled' },
                billing: { private: 'fixture-secret' },
              },
              { id: 'fixture-disabled', name: 'Disabled', policy: { state: 'disabled' } },
            ],
          },
        });
      } else {
        send({ id: message.id, error: { code: -32601, message: 'Unexpected request' } });
      }
    }
  });
} else {
  const rl = createInterface({ input: process.stdin });
  let initialized = false;
  let acknowledged = false;
  const send = (value) => process.stdout.write(JSON.stringify(value) + '\n');
  rl.on('line', (line) => {
    const message = JSON.parse(line);
    if (message.method === 'initialize' && message.params.clientInfo.name === 'pitchcrew') {
      initialized = true;
      console.log('fixture startup diagnostic');
      send({ id: message.id, result: { userAgent: 'fixture' } });
    } else if (message.method === 'initialized' && initialized) {
      acknowledged = true;
    } else if (
      message.method === 'model/list' &&
      acknowledged &&
      message.params.includeHidden === false
    ) {
      if (mode === 'codex-hang') return;
      if (mode === 'codex-exit') process.exit(0);
      if (mode === 'codex-invalid') {
        send({ id: message.id, result: { data: [{ token: 'fixture-secret' }] } });
        return;
      }
      if (mode === 'codex-error') {
        send({ id: message.id, error: { message: 'fixture-private-diagnostic' } });
        return;
      }
      send({ method: 'fixture/notification', params: {} });
      const row = {
        model: 'fixture-one',
        displayName: 'Fixture One',
        secretMetadata: 'fixture-secret',
      };
      if (message.params.cursor) {
        send({
          id: message.id,
          result: {
            data: [row, { model: 'fixture-two', displayName: 'Fixture Two' }],
            nextCursor: mode === 'codex-loop' ? 'page-two' : null,
          },
        });
      } else {
        const output =
          JSON.stringify({
            id: message.id,
            result: {
              data: [row, { model: 'hidden-model', displayName: 'Hidden', hidden: true }],
              nextCursor: 'page-two',
            },
          }) + '\n';
        // Exercise a JSON response split across stdout chunks.
        process.stdout.write(output.slice(0, 20));
        setTimeout(() => process.stdout.write(output.slice(20)), 5);
      }
    } else {
      // A session, auth or inference request is a contract failure.
      send({ id: message.id, error: { message: 'Unexpected request' } });
      process.exitCode = 1;
      rl.close();
    }
  });
}
