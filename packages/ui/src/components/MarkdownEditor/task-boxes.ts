import { mapTasks } from './tasks.ts';

/** A list item's own words, without its nested lists. */
const ownText = (item: Element | null) => {
  if (!item) return '';
  const copy = item.cloneNode(true) as Element;
  for (const list of copy.querySelectorAll('ul, ol')) list.remove();
  return copy.textContent?.trim() ?? '';
};

/**
 * Names each rendered task box by its task's text and links it to its source task (`data-from`)
 * in one pass. A box without a safe source match, or in a read-only preview, is disabled.
 */
export const linkTaskBoxes = (host: Element, source: string, editable: boolean) => {
  const boxes = [...host.querySelectorAll<HTMLInputElement>('.md-task-box')];
  const texts = boxes.map((box) => ownText(box.closest('li')));
  // Linking must never take the page down: on any surprise, every box stays read-only.
  let targets: (number | undefined)[] = [];
  try {
    if (editable) targets = mapTasks(source, texts);
  } catch {
    targets = boxes.map(() => undefined);
  }
  // When the boxes cannot be linked, say so in the note itself, not only on hover.
  const locked = host.querySelector<HTMLElement>('.md-tasks-locked');
  if (locked)
    locked.hidden = !(editable && boxes.length > 0 && targets.every((at) => at === undefined));
  boxes.forEach((box, index) => {
    const from = targets[index];
    box.setAttribute('aria-label', texts[index] || 'Task');
    box.disabled = from === undefined;
    if (from === undefined) delete box.dataset.from;
    else box.dataset.from = String(from);
    box.title = editable && from === undefined ? 'Edit tasks in Write for this note' : '';
  });
};
