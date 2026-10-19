import { createInterface } from 'node:readline';

const scenario = process.argv[2];
if (scenario === 'account') {
  createInterface({ input: process.stdin }).on('line', (line) => {
    const request = JSON.parse(line) as {
      id?: number;
      method?: string;
      params?: { refreshToken?: boolean };
    };
    if (request.method === 'initialize')
      console.log(JSON.stringify({ id: request.id, result: {} }));
    else if (request.method === 'account/read' && request.params?.refreshToken === false)
      console.log(
        JSON.stringify({
          id: request.id,
          result: { account: { type: 'apiKey' }, requiresOpenaiAuth: false },
        }),
      );
    else if (request.method !== 'initialized') {
      console.error('Unexpected turn or session request.');
      process.exit(2);
    }
  });
} else if (scenario === 'output') {
  console.log('Updating fixture runtime…');
  console.error('Fixture warning');
} else if (scenario === 'hang') {
  console.log('Fixture started');
  setInterval(() => {}, 1000);
} else if (scenario === 'prompt') {
  process.stdout.write('Password:');
  setInterval(() => {}, 1000);
} else if (scenario === 'large') {
  process.stdout.write('x'.repeat(2_000_001));
} else if (scenario === 'args') {
  console.log(JSON.stringify(process.argv.slice(3)));
}
