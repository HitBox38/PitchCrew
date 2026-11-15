import { createContext, useCallback, useContext, useLayoutEffect, useState } from 'react';

type Register = (slot: string) => () => void;

/**
 * Which slots a group's root contains, as a `data-has-` attribute per slot on the root, so styles
 * can follow them with a group data variant. This replaces Tailwind's group has variants (`:has()`
 * on an ancestor), which made Chrome recheck descendants after every change anywhere on the page.
 * Slots register before paint, so the first frame is already right.
 */
export const createPresence = () => {
  const Context = createContext<Register | null>(null);
  /** For the group's root: spread `attributes` on it and wrap its children in `Provider`. */
  const useRoot = () => {
    const [present, setPresent] = useState<Record<string, number>>({});
    const register = useCallback<Register>((slot) => {
      setPresent((counts) => ({ ...counts, [slot]: (counts[slot] ?? 0) + 1 }));
      return () => setPresent((counts) => ({ ...counts, [slot]: (counts[slot] ?? 1) - 1 }));
    }, []);
    const attributes = Object.fromEntries(
      Object.entries(present)
        .filter(([, count]) => count > 0)
        .map(([slot]) => [`data-has-${slot}`, '']),
    );
    return { Provider: Context.Provider, register, attributes };
  };
  /** For a slot inside the group: present while mounted (and `on`). */
  const usePresent = (slot: string, on = true) => {
    const register = useContext(Context);
    useLayoutEffect(() => (on && register ? register(slot) : undefined), [register, slot, on]);
  };
  return { useRoot, usePresent };
};
