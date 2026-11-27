import { expect, it } from 'vitest';
import { decideArmMs, pressesDecide } from '../useDecideShortcut.ts';

// Node has no DOM, and the rules only ask an element where it sits: `closest` and `contains`.
const button = {} as HTMLButtonElement;
const openRow = { contains: (node: unknown) => node === button };
const closedRow = { contains: () => false };
const inside = (row: object | null) =>
  ({ closest: (selector: string) => (selector === '.row' ? row : null) }) as unknown as Element;
const plain = { closest: () => null };
/** Enough of `Element.matches` for the field rule: a tag, `[name]`, `[name="value"]`, `:not(…)`. */
const matches = (selector: string, tag: string, attributes: Record<string, string>): boolean => {
  const [, compound = '', negated] = /^(.*?)(?::not\((.*)\))?$/.exec(selector) ?? [];
  if (negated && matches(negated, tag, attributes)) return false;
  const name = /^[a-z]+/.exec(compound)?.[0];
  if (name && name !== tag) return false;
  return [...compound.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].every(
    ([, key = '', value]) =>
      key in attributes && (value === undefined || attributes[key] === value),
  );
};
/** A focused element, without ancestors: `closest` asks only the element itself. */
const element = (tag: string, attributes: Record<string, string> = {}) => {
  const self = {
    closest: (selectors: string) =>
      selectors.split(',').some((selector) => matches(selector.trim(), tag, attributes))
        ? self
        : null,
  };
  return self as unknown as EventTarget;
};
// Node is never macOS here (`isMac` reads the user agent), so the modifier is Control.
const keydown = (fields: Partial<KeyboardEvent> = {}) =>
  ({
    key: 'Enter',
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false,
    defaultPrevented: false,
    isComposing: false,
    target: plain,
    ...fields,
  }) as unknown as KeyboardEvent;
const now = 10_000;
const presses = (event: KeyboardEvent, focused: Element | null = inside(openRow), armedAt = 0) =>
  pressesDecide(event, '.row', button, focused, armedAt, now);

it('presses the verb on Control/Command+Enter with focus inside its own scope', () => {
  expect(presses(keydown())).toBe(true);
  expect(presses(keydown({ key: 'a' }))).toBe(false);
  expect(presses(keydown({ ctrlKey: false, metaKey: true }))).toBe(false);
});

it('never takes a held, combined, composed or already used keystroke', () => {
  for (const fields of [
    { shiftKey: true },
    { altKey: true },
    { repeat: true },
    { isComposing: true },
    { defaultPrevented: true },
  ])
    expect(presses(keydown(fields))).toBe(false);
});

it('leaves a keystroke typed into a field to the field', () => {
  const from = (target: EventTarget) => presses(keydown({ target }));
  for (const tag of ['input', 'textarea', 'select']) expect(from(element(tag))).toBe(false);
  expect(from(element('div', { contenteditable: 'true' }))).toBe(false);
  expect(from(element('div', { contenteditable: 'false' }))).toBe(true);
  // Base UI's Select trigger (Tracking's Application choice) is a button with the combobox role.
  expect(from(element('button', { role: 'combobox' }))).toBe(false);
  for (const role of ['listbox', 'option', 'textbox', 'spinbutton', 'slider', 'checkbox', 'switch'])
    expect(from(element('div', { role }))).toBe(false);
  // Any other control in the scope presses the verb, as the browser tray's Details button does.
  expect(from(element('button'))).toBe(true);
  expect(from(element('button', { role: 'tab' }))).toBe(true);
});

it('fires only where focus sits in the scope that holds the verb', () => {
  expect(presses(keydown(), inside(null))).toBe(false);
  // A kept-mounted closed row shares the selector's shape but not the focused row.
  expect(presses(keydown(), inside(closedRow))).toBe(false);
  expect(presses(keydown(), null)).toBe(false);
  expect(pressesDecide(keydown(), '.row', null, inside(openRow), 0, now)).toBe(false);
});

it('waits after the surface shows a decision, so a repeated press cannot reach it', () => {
  expect(presses(keydown(), inside(openRow), now - decideArmMs + 1)).toBe(false);
  expect(presses(keydown(), inside(openRow), now - decideArmMs)).toBe(true);
});
