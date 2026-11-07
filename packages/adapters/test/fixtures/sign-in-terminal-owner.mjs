import { startSignInTerminal } from '../../src/process/sign-in-terminal.ts';
const terminal = startSignInTerminal({
  command: process.execPath,
  args: [process.argv[2], 'wait'],
  signal: new AbortController().signal,
  onOutput: (text) => {
    const pid = text.match(/READY:(\d+)/)?.[1];
    if (pid) process.send?.({ pid: Number(pid) }, () => process.exit(0));
  },
});
void terminal.completion.catch(() => {});
