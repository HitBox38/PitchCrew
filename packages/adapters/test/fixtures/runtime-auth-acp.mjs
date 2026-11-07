import { createInterface } from 'node:readline';
const mode = process.argv[2];
let authId,
  terminalDenied = false,
  filesDenied = false;
const send = (value) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...value }) + '\n');
createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line);
  if (request.method === 'initialize') {
    if (
      request.params.clientCapabilities.terminal ||
      request.params.clientCapabilities.fs.readTextFile ||
      request.params.clientCapabilities.fs.writeTextFile
    )
      process.exit(2);
    send({
      id: request.id,
      result: {
        protocolVersion: 1,
        authMethods: [
          { id: 'oauth', name: 'Native OAuth', type: 'agent' },
          {
            id: 'untrusted-terminal',
            name: 'A terminal command',
            type: 'terminal',
            args: ['run-anything'],
          },
          { id: 'api-key', name: 'API key', type: 'env_var', env: 'SECRET_KEY' },
        ],
      },
    });
  } else if (request.method === 'authenticate') {
    if (mode === 'discover' || request.params.methodId !== 'oauth') process.exit(3);
    authId = request.id;
    send({ id: 100, method: 'terminal/create', params: { command: 'forbidden-fixture-command' } });
  } else if (request.id === 100) {
    terminalDenied = request.error?.code === -32601;
    send({ id: 101, method: 'fs/read_text_file', params: { path: '/forbidden-fixture-file' } });
  } else if (request.id === 101) {
    filesDenied = request.error?.code === -32601;
    send({
      id: 102,
      method: 'session/elicitation',
      params: {
        mode: 'url',
        elicitationId: 'fixture-consent',
        url:
          mode === 'bad-url'
            ? 'https://example.invalid/auth'
            : 'https://auth.openai.com/oauth/authorize?state=fixture-state',
      },
    });
  } else if (request.id === 102) {
    if (!terminalDenied || !filesDenied || request.result?.action !== 'accept') process.exit(4);
    send({ id: authId, result: {} });
  } else if (request.method === 'session/new') {
    if (!terminalDenied || !filesDenied || request.params.mcpServers.length) process.exit(5);
    send({ id: request.id, result: { sessionId: 'fixture-auth-verification' } });
  } else process.exit(6); // A prompt, tool grant, or unrelated native request is forbidden.
});
