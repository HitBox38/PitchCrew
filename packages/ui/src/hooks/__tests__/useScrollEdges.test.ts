import { expect, it } from 'vitest';
import { scrollBoxes } from '../useScrollEdges.ts';

// Node has no DOM: an element here is only its children and its display.
type Fake = { name: string; display: string; children: Fake[] };
const box = (name: string, display = 'block', children: Fake[] = []): Fake => ({
  name,
  display,
  children,
});
const names = (elements: Element[]) => elements.map((element) => (element as unknown as Fake).name);
const display = (element: Element) => (element as unknown as Fake).display;

it('watches the boxes inside a child that gives up its own, which never reports a resize', () => {
  // Home's rail beside the desk: its sections are `display: contents`, its blocks the boxes.
  const rail = box('rail', 'grid', [
    box('crew at work', 'contents', [box('working now'), box('up next'), box('crew line')]),
    box('pipeline section', 'contents', [box('pipeline', 'block', [box('stages')])]),
    box('note'),
  ]);
  expect(names(scrollBoxes(rail as unknown as Element, display))).toEqual([
    'working now',
    'up next',
    'crew line',
    'pipeline',
    'note',
  ]);
  // A phone's sections have boxes of their own, so they are watched as they are.
  const phone = box('rail', 'grid', [box('crew at work', 'block', [box('working now')])]);
  expect(names(scrollBoxes(phone as unknown as Element, display))).toEqual(['crew at work']);
});
