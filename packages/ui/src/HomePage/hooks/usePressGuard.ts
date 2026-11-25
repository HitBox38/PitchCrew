import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { guardMs, guardReach } from '../constants.ts';

type Spot = { x: number; y: number; at: number };
/** `anywhere`: every click in the row's body counts, wherever it lands (no deciding click). */
type Armed = Spot & { key: string; anywhere?: boolean };

const far = (spot: Spot, event: MouseEvent) =>
  Math.hypot(event.clientX - spot.x, event.clientY - spot.y) > guardReach;

/**
 * After a pointer decision the next row opens where the pointer already is, so for `guardMs` a
 * second click within `guardReach` of the deciding click that lands in the newly opened row's
 * body is dropped (a slow double-click). Moving off the spot or waiting releases it. When the open
 * row leaves without a decision here, every click in the new row's body is held for `guardMs`.
 * Keyboard activations report no clicks and are never held back. The listeners sit on the desk
 * in the capture phase, so a dropped click never reaches the row's buttons.
 */
export const usePressGuard = (desk: RefObject<HTMLElement | null>) => {
  const press = useRef<Spot | null>(null);
  const armed = useRef<Armed | null>(null);
  useEffect(() => {
    const element = desk.current;
    if (!element) return;
    const down = (event: PointerEvent) => {
      press.current = { x: event.clientX, y: event.clientY, at: performance.now() };
    };
    const click = (event: MouseEvent) => {
      const spot = armed.current;
      if (!spot || event.detail === 0) return;
      if (performance.now() - spot.at > guardMs || (!spot.anywhere && far(spot, event))) {
        armed.current = null;
        return;
      }
      const body = (event.target as Element).closest('.needs-open-body');
      const row = body?.closest<HTMLElement>('[data-needs-key]');
      if (row?.dataset.needsKey !== spot.key) return;
      event.preventDefault();
      event.stopPropagation();
    };
    element.addEventListener('pointerdown', down, true);
    element.addEventListener('click', click, true);
    return () => {
      element.removeEventListener('pointerdown', down, true);
      element.removeEventListener('click', click, true);
    };
  }, [desk]);
  return useMemo(
    () => ({
      /** Arms the guard on the row that just opened, when a press started the deciding call. */
      arm: (key: string | null, startedAt: number) => {
        const spot = press.current;
        armed.current =
          key && spot && spot.at >= startedAt - guardMs
            ? { ...spot, key, at: performance.now() }
            : null;
      },
      /**
       * Holds every click in the body of the row that just opened in place of one that left on
       * its own (resolved elsewhere, or expired with its run): a click then was aimed at the row
       * that left, wherever it lands.
       */
      hold: (key: string | null) => {
        armed.current = key ? { x: 0, y: 0, at: performance.now(), key, anywhere: true } : null;
      },
    }),
    [],
  );
};
