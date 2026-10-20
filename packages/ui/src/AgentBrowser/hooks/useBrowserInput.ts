import { useEffect, type RefObject, type KeyboardEvent } from 'react';
import type { BrowserViewProps } from '../types.ts';
import { useBrowserTouch } from './useBrowserTouch.ts';
import { remotePoint } from '../helpers.ts';
export const useBrowserInput = (
  props: BrowserViewProps,
  image: RefObject<HTMLButtonElement | null>,
) => {
  const { frame, manual, control } = props;
  const touch = useBrowserTouch(props, image);
  const sendInput = control.input;
  useEffect(() => {
    const element = image.current;
    if (!manual || !element) return;
    const scroll = (event: WheelEvent) => {
      event.preventDefault();
      sendInput({
        kind: 'scroll',
        deltaX: Math.max(-2000, Math.min(2000, event.deltaX)),
        deltaY: Math.max(-2000, Math.min(2000, event.deltaY)),
      });
    };
    element.addEventListener('wheel', scroll, { passive: false });
    return () => element.removeEventListener('wheel', scroll);
  }, [manual, sendInput, image]);
  const press = (event: KeyboardEvent) => {
    if (!manual || event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget
        .closest('.agent-browser-panel')
        ?.querySelector<HTMLButtonElement>('[data-browser-controls] button:not(:disabled)')
        ?.focus();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      control.input({ kind: 'key', key: 'ControlOrMeta+A' });
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      control.input({ kind: 'key', key: 'Shift+Tab' });
    } else if (keys.has(event.key)) {
      event.preventDefault();
      control.input({ kind: 'key', key: event.key as 'Enter' });
    } else if (event.key === ' ') {
      event.preventDefault();
      control.input({ kind: 'key', key: 'Space' });
    } else if (event.key.length === 1) {
      event.preventDefault();
      control.input({ kind: 'text', text: event.key });
    }
  };
  const click = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!manual || touch.shouldIgnoreClick()) return;
    event.currentTarget.focus();
    const bounds = event.currentTarget.getBoundingClientRect();
    control.input({
      kind: 'click',
      viewport: { width: frame.width, height: frame.height },
      ...remotePoint(event.clientX, event.clientY, bounds, frame),
    });
  };
  return { press, click, touch: touch.handlers };
};

const keys = new Set([
  'Tab',
  'Enter',
  'Escape',
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]);
