import type { BrowserSessionInfo } from '@pitchcrew/core';

export function browserStatus(
  session: BrowserSessionInfo | undefined,
  hasControl: boolean,
  waiting: boolean,
  thread: string,
) {
  const manual = hasControl || !!session?.manual;
  const label = hasControl
    ? 'Your control'
    : session?.manual
      ? 'Paused'
      : waiting
        ? 'Needs approval'
        : session?.runId
          ? 'Browsing'
          : session?.status === 'open'
            ? 'Ready'
            : 'Closed';
  const elsewhere = !!session?.threadId && session.threadId !== thread;
  const detail = hasControl
    ? 'You’re controlling. Agent actions and inspection are paused.'
    : session?.manual
      ? 'Agent paused. Recover manual control to return it to the agent.'
      : waiting
        ? 'Waiting for your approval.'
        : session?.runId
          ? 'Agent browsing.'
          : session?.status === 'open'
            ? 'Browser ready.'
            : 'Browser closed.';
  return {
    label: `${label}${elsewhere ? ' elsewhere' : ''}`,
    manual,
    detail: `${detail}${elsewhere ? ' This browser belongs to another conversation. Open task details to see its source.' : ''}`,
  };
}

export function remotePoint(
  x: number,
  y: number,
  bounds: { left: number; top: number; width: number; height: number },
  frame: { width: number; height: number },
) {
  return {
    x: Math.max(0, Math.min(frame.width, ((x - bounds.left) * frame.width) / bounds.width)),
    y: Math.max(0, Math.min(frame.height, ((y - bounds.top) * frame.height) / bounds.height)),
  };
}
export function touchScroll(startY: number, endY: number, height: number, remoteHeight: number) {
  return Math.max(-2000, Math.min(2000, ((startY - endY) * remoteHeight) / height));
}
