import type { ITheme } from '@xterm/xterm';

export const terminalTheme = (host: HTMLElement): ITheme => {
  const style = getComputedStyle(host);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    background: token('--surface'),
    foreground: token('--ink'),
    cursor: token('--ink'),
    selectionBackground: token('--plum'),
    selectionForeground: token('--surface'),
    black: token('--ink'),
    brightBlack: token('--muted'),
    white: token('--ink'),
    brightWhite: token('--ink'),
    red: token('--rose'),
    brightRed: token('--rose'),
    green: token('--moss'),
    brightGreen: token('--moss'),
    yellow: token('--ochre'),
    brightYellow: token('--ochre'),
    blue: token('--primary'),
    brightBlue: token('--primary'),
    magenta: token('--plum'),
    brightMagenta: token('--plum'),
    cyan: token('--primary'),
    brightCyan: token('--primary'),
  };
};
