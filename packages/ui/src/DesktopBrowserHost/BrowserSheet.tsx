import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useDesktopBrowserHost } from './context.ts';

export const BrowserSheet = ({
  open,
  name,
  hide,
  children,
}: {
  open: boolean;
  name: string;
  hide(): void;
  children: ReactNode;
}) => {
  const host = useDesktopBrowserHost();
  const [owner] = useState(() => Symbol('browser-sheet'));
  const hideRef = useRef(hide);
  useLayoutEffect(() => {
    hideRef.current = hide;
  }, [hide]);
  const close = useCallback(() => hideRef.current(), []);
  const show = host?.show;
  const clear = host?.clear;
  useLayoutEffect(() => {
    if (open) show?.({ owner, name, hide: close, children });
    else clear?.(owner);
  }, [open, name, owner, show, clear, close, children]);
  useLayoutEffect(() => () => clear?.(owner), [clear, owner]);
  return null;
};
