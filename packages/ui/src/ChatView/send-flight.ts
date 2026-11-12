import { create } from 'zustand';
import type { ChatMessage, ChatReference } from '@pitchcrew/core';

/**
 * The send morph, done the way iMessage and Codex do it: the message is in the conversation the
 * moment it is sent, and one bubble travels from the composer to its place.
 *
 * - A copy of the bubble forms over the composer's text and springs, on the compositor, to where
 *   a new message appears: just below the last one. It leaves in the send's own frame: everything
 *   it needs is read before the send writes to the page, so it never waits for the transcript.
 * - A pending copy joins the transcript a frame later as the newest entry and is pinned like any
 *   new user message; the scroller's jump becomes a slide of the transcript, and the bubble rides
 *   up with it (same curve, same time) to its pinned place. When the daemon saves the message,
 *   the saved one takes over the same element (see transcriptKey), so nothing remounts.
 */
export interface PendingSend {
  id: string;
  text: string;
  references: ChatReference[];
  createdAt: string;
  /** Transcript entries on screen at send: the copy follows them, and an older message with the
   * same text never counts as this send's. */
  before: string[];
}
type Box = { left: number; top: number; width: number; height: number };
/** Everything the morph reads, taken before the send writes to the page. */
export interface SendOrigin {
  workspace: Element;
  scroller: HTMLElement;
  scrollTop: number;
  /** The draft's text in the composer. */
  text: DOMRect;
  /** The transcript lane: the top the new bubble is pinned at, how far below that it first
   * appears (under the last message, before the transcript scrolls) and the lane's bottom. */
  lane: { left: number; right: number; top: number; hold: number; bottom: number };
  /** A real message's and bubble's classes, and the padding plus border around its text. */
  messageClass: string;
  className: string;
  inset: { left: number; top: number };
  before: string[];
}
interface Flight {
  thread: string;
  id: string;
  origin: SendOrigin;
  layer: HTMLElement;
  bubble: HTMLElement;
  animation: Animation;
  /** How far below its pinned place the bubble waits for the transcript. */
  hold: number;
  launched: number;
  timer: ReturnType<typeof setTimeout>;
}

/** Per thread, the send shown in the transcript before the daemon has saved it. */
export const usePendingSends = create<Record<string, PendingSend | undefined>>(() => ({}));
const pendingPrefix = 'pending-send:';
export const pendingMessageId = (id: string) => pendingPrefix + id;
export const pendingSendId = (messageId: string) =>
  messageId.startsWith(pendingPrefix) ? messageId.slice(pendingPrefix.length) : undefined;
export const clearPendingSend = (thread: string, id: string) =>
  usePendingSends.setState((state) =>
    state[thread]?.id === id ? { ...state, [thread]: undefined } : state,
  );
/** The compact snapshot drops finished requests, so a saved message often arrives unlinked;
 * a new user message with the same text identifies it. */
export const sameSend = (pending: PendingSend, message: ChatMessage) =>
  message.from === 'user' &&
  message.content.trim() === pending.text.trim() &&
  !pending.before.includes(message.id);

// shortcut: one entry per animated send this session; prune it if sessions get very long.
const confirmed = new Map<string, string>();
/** The saved message keeps rendering under its pending copy's key: the same element and scroller
 * item throughout, so the swap is invisible to React, Motion and the scroller. */
export const confirmPendingSend = (messageId: string, id: string) =>
  confirmed.set(messageId, pendingMessageId(id));
export const transcriptKey = (itemId: string) => confirmed.get(itemId) ?? itemId;

/**
 * The flight's curve: a strong ease-out with a 3% clay overshoot, close to an iOS spring
 * (response 0.38s, damping 0.72). A cubic-bezier rather than a sampled `linear()` spring, and pixel
 * offsets rather than percentages, because Chrome runs only those on the compositor, and the
 * bubble must keep moving while the page renders the send.
 */
const spring = { easing: 'cubic-bezier(0.25, 1.3, 0.4, 1)', duration: 550 };

let flight: Flight | undefined;

const boxOf = (element: Element | null | undefined): Box => {
  const { left = 0, top = 0, width = 0, height = 0 } = element?.getBoundingClientRect() ?? {};
  return { left, top, width, height };
};
const px = (value: string) => parseFloat(value) || 0;
const flightSelector = (id: string) => `[data-send-flight="${CSS.escape(id)}"]`;

/** Where a new entry lands, known before it renders: right below the last entry, until the
 * scroller pins it (a new user message) 64px below the top of its content, scrolling no further
 * back than the start. */
export const entryTops = (at: {
  viewportTop: number;
  scrollTop: number;
  padding: number;
  previousBottom: number;
  gap: number;
}) => {
  const offset = at.previousBottom - at.viewportTop + at.scrollTop + at.gap;
  return {
    natural: at.previousBottom + at.gap,
    pinned: at.viewportTop + offset - Math.max(0, offset - at.padding - 64),
  };
};

/** Reads where the draft is and where its message will land, before the send clears it. */
export const sendFlightOrigin = (editor: HTMLElement | null): SendOrigin | undefined => {
  const workspace = editor?.closest('.chat-workspace');
  const scroller = workspace?.querySelector<HTMLElement>('[data-slot="message-scroller-viewport"]');
  const content = scroller?.querySelector('[data-slot="message-scroller-content"]');
  if (!editor || !workspace || !scroller || !content) return undefined;
  const range = document.createRange();
  range.selectNodeContents(editor);
  const text = range.getBoundingClientRect();
  if (!text.width) return undefined;
  const entries = [...content.children].filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && !!element.dataset.messageId,
  );
  const last = entries.at(-1);
  const box = content.getBoundingClientRect();
  const style = getComputedStyle(content);
  const lastBox = last ? boxOf(last) : undefined;
  // A user bubble on screen gives the bubble's look, its right edge and its offset below the
  // message's "You" line; without one, the lane's edge and a typical header stand in.
  const sample = [...content.querySelectorAll('.chat-message.is-user .chat-message-content')].at(
    -1,
  );
  const sampleBox = sample ? boxOf(sample) : undefined;
  const header = sampleBox ? sampleBox.top - boxOf(sample!.closest('.chat-message')).top : 27;
  const bubble = sample ? getComputedStyle(sample) : undefined;
  const viewport = boxOf(scroller);
  const tops = entryTops({
    viewportTop: viewport.top,
    scrollTop: scroller.scrollTop,
    padding: px(style.paddingTop),
    previousBottom: lastBox ? lastBox.top + lastBox.height : box.top + px(style.paddingTop),
    gap: last ? px(style.rowGap) : 0,
  });
  return {
    workspace,
    scroller,
    scrollTop: scroller.scrollTop,
    text,
    lane: {
      left: lastBox?.left ?? box.left + px(style.paddingLeft),
      right: sampleBox
        ? sampleBox.left + sampleBox.width
        : lastBox
          ? lastBox.left + lastBox.width
          : box.right,
      top: tops.pinned + header,
      hold: Math.max(0, tops.natural - tops.pinned),
      bottom: viewport.top + viewport.height,
    },
    messageClass: sample?.closest('.chat-message')?.className ?? 'chat-message is-user',
    className: sample?.className ?? 'chat-message-content',
    inset: bubble
      ? {
          left: px(bubble.paddingLeft) + px(bubble.borderLeftWidth),
          top: px(bubble.paddingTop) + px(bubble.borderTopWidth),
        }
      : { left: 17, top: 12 },
    before: [...workspace.querySelectorAll<HTMLElement>('[data-message-id]')].map(
      (element) => element.dataset.messageId ?? '',
    ),
  };
};

/** A bubble that never found its copy fades where it formed. */
export const dropSendFlight = () => {
  const current = flight;
  if (!current) return;
  flight = undefined;
  clearTimeout(current.timer);
  current.layer
    .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'ease-out' })
    .finished.finally(() => current.layer.remove());
};

/** A failed send leaves nothing behind: its draft is back in the composer. */
export const cancelSendFlight = (thread: string, id: string) => {
  if (flight?.id === id) dropSendFlight();
  clearPendingSend(thread, id);
};

/**
 * The bubble is in the send's first frame and flying while the page renders the rest. It sits in
 * a copy of the lane at the estimated landing, sized by the same CSS as a real bubble, and starts
 * over the draft's text; its width (one layout read) gives the offset from its right-aligned place.
 */
export const launchSendFlight = (
  thread: string,
  send: Pick<PendingSend, 'id' | 'text' | 'references'>,
  origin: SendOrigin,
) => {
  dropSendFlight();
  if (!send.text.trim()) return;
  const layer = document.createElement('div');
  layer.className = 'chat-send-flight';
  layer.setAttribute('aria-hidden', 'true');
  const lane = document.createElement('div');
  lane.style.left = `${origin.lane.left}px`;
  lane.style.width = `${origin.lane.right - origin.lane.left}px`;
  lane.style.top = `${origin.lane.top}px`;
  const message = document.createElement('div');
  message.className = origin.messageClass;
  const bubble = document.createElement('div');
  bubble.className = origin.className;
  // Drawn by CSS from the attribute, so the copy never doubles the message in text queries.
  bubble.dataset.text = send.text.trim();
  message.append(bubble);
  lane.append(message);
  layer.append(lane);
  origin.workspace.append(layer);
  const dx = origin.text.left - origin.inset.left - (origin.lane.right - bubble.offsetWidth);
  const dy = origin.text.top - origin.inset.top - origin.lane.top;
  // It waits below the last message, kept clear of the composer when that is off the bottom.
  const hold = Math.max(
    0,
    Math.min(origin.lane.hold, origin.lane.bottom - origin.lane.top - bubble.offsetHeight),
  );
  const animation = bubble.animate(
    [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: `translateY(${hold}px)` }],
    { ...spring, fill: 'both' },
  );
  flight = {
    thread,
    id: send.id,
    origin,
    layer,
    bubble,
    animation,
    hold,
    launched: performance.now(),
    timer: setTimeout(dropSendFlight, 4000),
  };
  // After this frame is painted, so the bubble is already on its way when the transcript renders
  // the copy.
  requestAnimationFrame(() =>
    setTimeout(() => {
      if (flight?.id !== send.id) return;
      usePendingSends.setState((state) => ({
        ...state,
        [thread]: { ...send, createdAt: new Date().toISOString(), before: origin.before },
      }));
      setTimeout(() => clearPendingSend(thread, send.id), 15000);
    }),
  );
};

/** The transcript's slide up to the pinned message: the same iOS curve as the app's drawers. */
const slideEase = 'cubic-bezier(0.32, 0.72, 0, 1)';
const shiftOf = (element: Element | null | undefined) =>
  element ? new DOMMatrixReadOnly(getComputedStyle(element).transform).m42 : 0;

/** The scroller's own scroll-to, so its reserved space and pinning stay consistent. */
type ScrollToMessage = (
  messageId: string,
  options: { align: 'start'; behavior: 'auto'; scrollMargin: number },
) => unknown;

/**
 * Called as the pending copy mounts (or the saved message, if it won the race), before paint:
 * hides it, pins it, turns the scroller's jump into a slide and glides the bubble onto it.
 */
export const landSendFlight = (
  thread: string,
  key: string,
  messageId: string,
  scrollToMessage: ScrollToMessage,
) => {
  const id = pendingSendId(key);
  const current = flight;
  if (!id || !current || current.thread !== thread || current.id !== id) return;
  const copy = document.querySelector<HTMLElement>(
    `[data-chat-message-id="${CSS.escape(messageId)}"]`,
  );
  if (!copy?.querySelector('.chat-message-content')) return;
  flight = undefined;
  clearTimeout(current.timer);
  // Stays on the element through the swap to the saved message, which reuses it.
  copy.dataset.sendFlight = id;
  const { origin, layer, bubble, animation, hold } = current;
  const content = origin.scroller.querySelector('[data-slot="message-scroller-content"]');
  // Where the copy rests once the transcript's slide ends; read through the element, which the
  // saved message keeps when it takes over.
  const resting = () => {
    const box = boxOf(copy.querySelector('.chat-message-content'));
    box.top -= shiftOf(content);
    return box;
  };
  // Where the bubble lands by itself: its laid-out place, without transforms (offsets ignore
  // them), summed up to the layer, which covers the viewport.
  const landing = () => {
    const at = { left: 0, top: 0 };
    for (
      let element: Element | null = bubble;
      element instanceof HTMLElement && element !== layer;
    ) {
      at.left += element.offsetLeft;
      at.top += element.offsetTop;
      element = element.offsetParent;
    }
    return at;
  };
  // The bubble swaps for the message in place; its "You" line, which did not fly, fades in.
  const finish = () => {
    for (const element of document.querySelectorAll<HTMLElement>(flightSelector(id))) {
      delete element.dataset.sendFlight;
      element
        .querySelector('.chat-message-meta')
        ?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
    }
    layer.remove();
  };
  // Carries the whole flight from where the bubble waits to the message: with the transcript's
  // slide when it rides along, otherwise in what is left of its flight (at least a short glide).
  let carried = { x: 0, y: 0 };
  const gap = (to: Box) => {
    const from = landing();
    return { x: to.left - from.left, y: to.top - from.top - hold };
  };
  // What is left of the bubble's flight, so what starts now still ends with it.
  const left = () => Math.max(160, current.launched + spring.duration - performance.now());
  const carry = (
    to: Box,
    timing = { duration: left(), easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
  ) => {
    const next = gap(to);
    const start = `translate(${carried.x}px, ${carried.y}px)`;
    carried = next;
    return layer.animate(
      [{ transform: start }, { transform: `translate(${next.x}px, ${next.y}px)` }],
      { ...timing, fill: 'forwards' },
    ).finished;
  };
  const off = (to: Box) => {
    const next = gap(to);
    return Math.hypot(next.x - carried.x, next.y - carried.y);
  };
  // The scroller pins a new message only when it is the last entry; the agent's turn often
  // renders first, so pin it here too, as the scroller does (64px of the entry before showing).
  // This microtask runs after the scroller's own mutation callback and before paint. The jump
  // becomes a slide: the transcript starts where it was and moves up on the compositor while the
  // bubble lands, so later scroll corrections never fight it.
  queueMicrotask(() => {
    scrollToMessage(messageId, { align: 'start', behavior: 'auto', scrollMargin: 64 });
    const to = resting();
    if (!to.width || !to.height) return finish();
    const shift = origin.scroller.scrollTop - origin.scrollTop;
    // The bubble rides the slide: both start in this frame with the same curve and length, so
    // they move as one; the bubble hands over only once the slide has ended.
    const slide = { duration: Math.max(320, left()), easing: slideEase };
    const sliding =
      content && Math.abs(shift) >= 2
        ? content.animate([{ transform: `translateY(${shift}px)` }, { transform: 'none' }], slide)
            .finished
        : undefined;
    // The estimate's size is normally exact (the same CSS sizes both); if the message wrapped
    // differently, the bubble takes its size.
    if (Math.abs(to.width - bubble.offsetWidth) + Math.abs(to.height - bubble.offsetHeight) >= 2) {
      bubble.style.width = `${to.width}px`;
      bubble.style.height = `${to.height}px`;
    }
    const carrying = off(to) >= 1 ? carry(to, sliding ? slide : undefined) : undefined;
    // Once it has landed, a message the transcript moved since gets one more short glide; then
    // the bubble hands over and moves with the conversation instead of chasing it.
    void Promise.all([animation.finished, carrying, sliding])
      .then(() => {
        const now = resting();
        return now.width && off(now) >= 2 ? carry(now) : undefined;
      })
      .catch(() => {})
      .finally(finish);
  });
};
