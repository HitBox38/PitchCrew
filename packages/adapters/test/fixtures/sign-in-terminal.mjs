const mode = process.argv[2];
if (mode === 'overflow') {
  process.stdout.write('x'.repeat(280_000));
  setInterval(() => {}, 1000);
} else if (mode === 'fail') {
  process.stdout.write('Fictional authentication failed\n');
  process.exitCode = 2;
} else {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(`READY:${process.pid}:TTY=${process.stdin.isTTY && process.stdout.isTTY}\n`);
  let pending = '';
  process.stdin.on('data', (data) => {
    pending += data.toString();
    if (!pending.includes('\r') && !pending.includes('\n')) return;
    if (pending.trim() === 'size') {
      // Read the PTY size now: `columns`/`rows` refresh only when SIGWINCH is handled, which can follow this input.
      const [columns, rows] = process.stdout.getWindowSize();
      process.stdout.write(`SIZE:${columns}:${rows}\n`);
      pending = '';
    } else if (pending.trim() === 'finish') {
      process.stdout.write('FINISHED\n');
      process.exit(0);
    }
  });
}
