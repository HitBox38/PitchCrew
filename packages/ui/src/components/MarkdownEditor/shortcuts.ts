const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const glyphs: Record<string, string> = { Mod: '⌘', Shift: '⇧', Alt: '⌥', Enter: '↩' };
const words: Record<string, string> = { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Enter: 'Enter' };

/** "⌘⇧8" on macOS, "Ctrl+Shift+8" elsewhere. */
export const shortcutLabel = (keys: readonly string[]) =>
  mac
    ? keys.map((key) => glyphs[key] ?? key.toUpperCase()).join('')
    : keys.map((key) => words[key] ?? key.toUpperCase()).join('+');

/** The aria-keyshortcuts form: "Meta+Shift+8" or "Control+Shift+8". */
export const shortcutAria = (keys: readonly string[]) =>
  keys.map((key) => (key === 'Mod' ? (mac ? 'Meta' : 'Control') : key)).join('+');

/** Editor shortcuts, shared by the toolbar's tooltips and the help list. */
export const editorKeys = {
  bold: ['Mod', 'B'],
  italic: ['Mod', 'I'],
  strike: ['Mod', 'Shift', 'X'],
  code: ['Mod', 'E'],
  link: ['Mod', 'K'],
  paragraph: ['Mod', 'Alt', '0'],
  h1: ['Mod', 'Alt', '1'],
  h2: ['Mod', 'Alt', '2'],
  h3: ['Mod', 'Alt', '3'],
  number: ['Mod', 'Shift', '7'],
  bullet: ['Mod', 'Shift', '8'],
  task: ['Mod', 'Enter'],
  find: ['Mod', 'F'],
  save: ['Mod', 'S'],
} as const satisfies Record<string, readonly string[]>;
