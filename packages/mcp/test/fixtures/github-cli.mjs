const mode = process.argv[2];
if (mode === 'oversize') process.stdout.write('x'.repeat(2_000_001));
else if (mode === 'wait') setInterval(() => {}, 1000);
else if (mode === 'error') {
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
