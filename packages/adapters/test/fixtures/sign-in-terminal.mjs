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
  // Node refreshes `columns`/`rows` (and `getWindowSize()`, which returns them) only when it handles SIGWINCH, which can
  // run after input that was written after the resize. Announce each completed refresh so callers can wait for it.
  process.stdout.on('resize', () => {
    process.stdout.write(`RESIZED:${process.stdout.columns}:${process.stdout.rows}\n`);
  });
  process.stdout.write(`READY:${process.pid}:TTY=${process.stdin.isTTY && process.stdout.isTTY}\n`);
  let pending = '';
  process.stdin.on('data', (data) => {
    pending += data.toString();
    if (!pending.includes('\r') && !pending.includes('\n')) return;
    if (pending.trim() === 'size') {
      process.stdout.write(`SIZE:${process.stdout.columns}:${process.stdout.rows}\n`);
      pending = '';
    } else if (pending.trim() === 'finish') {
      process.stdout.write('FINISHED\n');
      process.exit(0);
    }
  });
}
