import { useRef, useState, type MouseEvent, type SyntheticEvent } from 'react';
import type { BaseUIEvent } from '@base-ui/react/types';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { contextFocusTarget, selectedText } from '../helpers.ts';
import type { ContextMenuContentProps } from '@/components/ui/context-menu/types.ts';
import type { AppContextMenuProps } from '../types.ts';

export const useAppContextMenu = (props: AppContextMenuProps) => {
  const [open, setOpen] = useState(false);
  const [selectionOnly, setSelectionOnly] = useState(false);
  const [anchor, setAnchor] = useState<ContextMenuContentProps['anchor']>();
  const [selection, setSelection] = useState('');
  const [link, setLink] = useState('');
  const previousFocus = useRef<HTMLElement | null>(null);
  const managesFocus = useRef(false);
  const captureSelection = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    const text = selectedText(target);
    if (!(target instanceof Element) || !text) return;
    event.preventDefault();
    event.stopPropagation();
    const { clientX: x, clientY: y } = event;
    managesFocus.current = false;
    previousFocus.current = contextFocusTarget(target);
    setSelection(text);
    setLink('');
    setSelectionOnly(true);
    setAnchor({ getBoundingClientRect: () => DOMRect.fromRect({ x, y }) });
    setOpen(true);
  };
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
    setSelectionOnly(false);
    setAnchor(undefined);
    previousFocus.current = contextFocusTarget(target);
    setSelection(selectedText(target));
    setLink(target.closest<HTMLAnchorElement>('a[href]')?.href ?? '');
  };
  const perform = (action: () => void) => {
    managesFocus.current = true;
    action();
  };
  return {
    open,
    anchor,
    selectionOnly,
    captureSelection,
    selection,
    link,
    prepare,
    finalFocus: () => (managesFocus.current ? false : (previousFocus.current ?? true)),
    openChange: (open: boolean) => {
      setOpen(open);
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
