import type { Terminal } from '@xterm/xterm';

/** Read the rendered screen and scrollback, joining soft wraps without retaining VT redraws. */
export const terminalBufferText = (terminal: Terminal) => {
  const buffer = terminal.buffer.active;
  let text = '';
  for (let index = 0; index < buffer.length; index++) {
    const line = buffer.getLine(index);
    if (line) text += `${index && !line.isWrapped ? '\n' : ''}${line.translateToString(true)}`;
  }
  return text.trimEnd();
};
