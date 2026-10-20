import { useState, type KeyboardEvent, type RefObject } from 'react';
import type { visibleProfileTree } from '../tree.ts';

type Row = ReturnType<typeof visibleProfileTree>[number];
export const useProfileTreeKeyboard = (
  tree: RefObject<HTMLDivElement | null>,
  rows: Row[],
  collapsed: Set<string>,
  toggle: (path: string) => void,
  searching: boolean,
) => {
  const [focused, setFocused] = useState('folder:');
  const focusKey = rows.some(({ node }) => node.key === focused) ? focused : rows[0]?.node.key;
  const focus = (key: string) => {
    setFocused(key);
    [...(tree.current?.querySelectorAll<HTMLButtonElement>('[data-node-key]') ?? [])]
      .find((element) => element.dataset.nodeKey === key)
      ?.focus();
  };
  const keyDown = (event: KeyboardEvent, row: Row) => {
    const index = rows.findIndex(({ node }) => node.key === row.node.key);
    const expanded = searching || !collapsed.has(row.node.path);
    switch (event.key) {
      case 'ArrowDown':
        focus(rows[Math.min(index + 1, rows.length - 1)].node.key);
        break;
      case 'ArrowUp':
        focus(rows[Math.max(index - 1, 0)].node.key);
        break;
      case 'Home':
        focus(rows[0].node.key);
        break;
      case 'End':
        focus(rows.at(-1)!.node.key);
        break;
      case 'ArrowRight':
        if (!row.node.folder) return;
        if (!expanded) toggle(row.node.path);
        else if (rows[index + 1]?.parent === row.node.key) focus(rows[index + 1].node.key);
        break;
      case 'ArrowLeft':
        if (row.node.folder && expanded && !searching) toggle(row.node.path);
        else if (row.parent) focus(row.parent);
        break;
      default:
        return;
    }
    event.preventDefault();
  };
  return { focusKey, setFocused, keyDown };
};
