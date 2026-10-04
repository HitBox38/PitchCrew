import { writeFile } from 'node:fs/promises';
const [mode, ...args] = process.argv.slice(2);
const output = args[args.indexOf('--output') + 1];
if (mode === 'inspect') {
  console.log(
    JSON.stringify({
      args,
      cwd: process.cwd(),
      overrides: [
        process.env.GOOGLE_WORKSPACE_CLI_TOKEN,
        process.env.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE,
        process.env.GOOGLE_APPLICATION_CREDENTIALS,
      ],
      debug: process.env.RUST_LOG,
    }),
  );
} else if (mode === 'oversize') {
  process.stdout.write('x'.repeat(2_000_001));
} else if (mode === 'error') {
  console.error('fictional-secret-from-cli');
  process.exitCode = 1;
} else if (mode === 'wait') {
  setInterval(() => {}, 1000);
} else if (mode === 'json') {
  console.log('{"fictional":"JSON content"}');
} else {
  await writeFile(output, mode === 'oversize-file' ? 'x'.repeat(2_000_001) : 'Fictional text\n');
  if (mode === 'wait-file') setInterval(() => {}, 1000);
  else
    console.log(
      JSON.stringify({
        status: 'success',
        saved_file: output,
        mimeType: mode === 'binary' ? 'application/pdf' : 'text/plain; charset=utf-8',
        bytes: 15,
      }),
    );
}
