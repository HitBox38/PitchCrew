const mode = process.argv[2];
if (mode === 'oversize') process.stdout.write('x'.repeat(2_000_001));
else if (mode === 'wait') setInterval(() => {}, 1000);
else if (mode === 'stdin') {
  const chunks: Buffer[] = [];
  process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
  process.stdin.on('end', () => process.stdout.write(Buffer.concat(chunks)));
} else if (mode === 'error') {
  process.stderr.write('fictional-sensitive-token');
  process.exitCode = 1;
} else
  console.log(
    JSON.stringify({
      args: process.argv.slice(3),
      interactive: process.env.GH_PROMPT_DISABLED,
      debug: process.env.GH_DEBUG ?? null,
    }),
  );
