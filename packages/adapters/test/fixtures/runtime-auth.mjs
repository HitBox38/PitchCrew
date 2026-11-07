import { createInterface } from 'node:readline';

const mode = process.argv[2];
if (!mode.startsWith('claude') && process.argv.includes('--ignore-user-config'))
  throw new Error('Unsupported app-server argument.');
const send = (value) => process.stdout.write(JSON.stringify(value) + '\n');
if (mode.startsWith('claude')) {
  process.stdout.write('Documentation: https://code.claude.com/docs/en/authentication\n');
  process.stdout.write('https://claude.ai/oauth/authorize?state=fixture-state\n');
  process.stdout.write('Paste code here: ');
  createInterface({ input: process.stdin }).on('line', (line) => {
    process.exitCode = line === 'fixture-code#fixture-state' ? 0 : 1;
    process.stdin.destroy();
  });
} else {
  createInterface({ input: process.stdin }).on('line', (line) => {
    const request = JSON.parse(line);
    if (request.method === 'initialize') send({ id: request.id, result: {} });
    else if (request.method === 'account/login/start') {
      if (request.params.type !== 'chatgpt') process.exit(2);
      send({
        id: request.id,
        result: {
          type: 'chatgpt',
          loginId: 'fixture-login',
          authUrl:
            mode === 'bad-url'
              ? 'https://example.invalid/oauth/authorize'
              : 'https://auth.openai.com/oauth/authorize?state=fixture-state',
        },
      });
      if (mode === 'success' || mode === 'missing-account')
        send({
          method: 'account/login/completed',
          params: { loginId: 'fixture-login', success: true },
        });
      if (mode === 'failed')
        send({
          method: 'account/login/completed',
          params: {
            loginId: 'fixture-login',
            success: false,
            error: 'Secret fixture detail must not leave the helper.',
          },
        });
      if (mode === 'mismatched')
        send({
          method: 'account/login/completed',
          params: { loginId: 'another-login', success: true },
        });
      if (mode === 'premature') process.exit(0);
      if (mode === 'overflow') process.stderr.write('x'.repeat(257000));
    } else if (request.method === 'account/read')
      send({
        id: request.id,
        result: {
          account:
            mode === 'missing-account'
              ? null
              : { type: 'chatgpt', email: 'unused@example.invalid' },
        },
      });
    else if (request.method !== 'initialized' && request.method !== 'account/login/cancel')
      process.exit(3); // A thread or inference request is forbidden in every fixture.
  });
}
