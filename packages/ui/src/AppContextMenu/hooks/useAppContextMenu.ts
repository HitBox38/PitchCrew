import { useRef, useState, type SyntheticEvent } from 'react';
import type { BaseUIEvent } from '@base-ui/react/types';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { AppContextMenuProps } from '../types.ts';

export const useAppContextMenu = (props: AppContextMenuProps) => {
  const [selection, setSelection] = useState('');
  const [link, setLink] = useState('');
  const previousFocus = useRef<HTMLElement | null>(null);
  const managesFocus = useRef(false);
  const prepare = (event: BaseUIEvent<SyntheticEvent>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="menu"], [data-native-context-menu]',
      )
    ) {
      event.preventBaseUIHandler();
      event.stopPropagation();
      return;
    }
    previousFocus.current =
      target.closest<HTMLElement>('button, a[href], [tabindex]') ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setSelection(window.getSelection()?.toString() ?? '');
    setLink(target.closest<HTMLAnchorElement>('a[href]')?.href ?? '');
  };
  const perform = (action: () => void) => {
    managesFocus.current = true;
    action();
  };
  return {
    selection,
    link,
    prepare,
    finalFocus: () => (managesFocus.current ? false : (previousFocus.current ?? true)),
    openChange: (open: boolean) => {
      if (open) managesFocus.current = false;
    },
    search: () => perform(() => props.setPaletteOpen(true)),
    addJob: () => perform(() => props.setAdd(true)),
    newConversation: () =>
      perform(() => useWorkspaceStore.getState().setCreatingConversation(true)),
    navigate: (view: Parameters<typeof props.go>[0]) => perform(() => props.go(view)),
    refresh: () => void props.reload().catch(() => {}),
  };
};
