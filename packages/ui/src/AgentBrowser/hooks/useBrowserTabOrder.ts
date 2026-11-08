import { useState } from 'react';
import type { NativeBrowserModel } from './useNativeBrowser.ts';
import { movedTabOrder } from '../tab-drag.ts';

/**
 * The strip's tab order, with a moved tab shown in place until the native state (returned by
 * the move itself) catches up, so a drop never snaps back for a frame.
 */
export const useBrowserTabOrder = (model: NativeBrowserModel) => {
  const tabs = model.state?.tabs ?? [];
  const [pending, setPending] = useState<string[] | null>(null);
  const ordered = pending
    ? [
        ...pending.flatMap((id) => tabs.filter((tab) => tab.id === id)),
        ...tabs.filter((tab) => !pending.includes(tab.id)),
      ]
    : tabs;
  const move = (id: string, index: number) => {
    const ids = ordered.map((tab) => tab.id);
    const next = movedTabOrder(ids, id, index);
    if (next.every((item, position) => item === ids[position])) return false;
    setPending(next);
    void model
      .command({ kind: 'move-tab', tabId: id, index: next.indexOf(id) })
      .finally(() => setPending(null));
    return true;
  };
  return { tabs: ordered, move };
};
