import { useRef, type PointerEvent, type RefObject } from 'react';
import { touchScroll } from '../helpers.ts';
import type { BrowserViewProps } from '../types.ts';

export const useBrowserTouch = (
  { manual, frame, control }: BrowserViewProps,
  image: RefObject<HTMLButtonElement | null>,
) => {
  const gesture = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const ignoreClick = useRef(false);
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!manual) return;
    ignoreClick.current = false;
    if (event.pointerType !== 'touch') return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = gesture.current;
    if (
      start?.id === event.pointerId &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8
    )
      start.moved = true;
  };
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start || start.id !== event.pointerId || !manual) return;
    ignoreClick.current = start.moved;
    if (start.moved && Math.abs(event.clientY - start.y) > Math.abs(event.clientX - start.x)) {
      const height = image.current!.getBoundingClientRect().height;
      control.input({
        kind: 'scroll',
        deltaX: 0,
        deltaY: touchScroll(start.y, event.clientY, height, frame.height),
      });
    }
  };
  const onPointerCancel = () => {
    gesture.current = null;
    ignoreClick.current = true;
  };
  const shouldIgnoreClick = () => {
    const ignored = ignoreClick.current;
    ignoreClick.current = false;
    return ignored;
  };
  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    shouldIgnoreClick,
  };
};
