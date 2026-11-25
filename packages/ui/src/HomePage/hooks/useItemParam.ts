import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

/** The `?item=` key Home was opened with (a link from elsewhere), if any. */
export const useWantedItem = () => useSearch({ from: '/' }).item;

/**
 * Home opened with `?item=<key>`, as it mounted or later from an in-app link: the desk opens that
 * row (and its fold) and focuses its trigger, scrolling it into view, then the parameter clears
 * with a replacing navigation, so going back never reopens it. The URL is the outside system
 * this follows; a key no longer waiting is cleared without opening anything.
 */
export const useItemParam = (wanted: string | undefined, show: (key: string) => void) => {
  const navigate = useNavigate({ from: '/' });
  const handled = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!wanted) {
      handled.current = undefined;
      return;
    }
    if (handled.current === wanted) return;
    handled.current = wanted;
    show(wanted);
    void navigate({ search: {}, replace: true });
  }, [wanted, show, navigate]);
};
