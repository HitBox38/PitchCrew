import { useEffect, useState } from 'react';
import { hasNewQueueAttention } from '../queue-presentation.ts';

type Disclosure = { thread: string; open: boolean; attention: string[] };
const key = (thread: string) => `pitchcrew.chat.queue.v1.${thread}`;
const read = (thread: string, attention: string[], defaultOpen: boolean): Disclosure => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key(thread)) ?? 'null');
    if (
      saved &&
      typeof saved === 'object' &&
      'open' in saved &&
      typeof saved.open === 'boolean' &&
      'attention' in saved &&
      Array.isArray(saved.attention) &&
      saved.attention.every((item) => typeof item === 'string')
    )
      return {
        thread,
        attention,
        open: saved.open || hasNewQueueAttention(saved.attention, attention),
      };
  } catch {
    /* A denied or stale device preference must never block the queue. */
  }
  return { thread, attention, open: defaultOpen };
};

/** Reopen new attention while preserving the mounted message editors and their drafts. */
export const useQueueDisclosure = (thread: string, attention: string[], defaultOpen = false) => {
  const signature = JSON.stringify(attention);
  const [state, setState] = useState(() => read(thread, attention, defaultOpen));
  let current = state;
  if (state.thread !== thread) current = read(thread, attention, defaultOpen);
  else if (JSON.stringify(state.attention) !== signature)
    current = {
      thread,
      attention,
      open: state.open || hasNewQueueAttention(state.attention, attention),
    };
  if (current !== state) setState(current);
  useEffect(() => {
    try {
      localStorage.setItem(
        key(current.thread),
        JSON.stringify({ open: current.open, attention: current.attention }),
      );
    } catch {
      /* Device preferences are best effort. */
    }
  }, [current]);
  return {
    open: current.open,
    setOpen: (open: boolean) => setState({ thread, attention, open }),
  };
};
