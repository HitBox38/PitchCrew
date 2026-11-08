import { useEffect, useState } from 'react';
import type { Snapshot } from '@pitchcrew/core';
import { useBrowserSessions } from './useBrowserSessions.ts';
import type { BrowserPanelView } from '../layout.ts';

type Preference = {
  thread: string;
  open: boolean;
  dismissed: boolean;
  selectedId: string;
  width: number;
  view: BrowserPanelView;
};
const readPreference = (thread: string): Preference => {
  const fallback: Preference = {
    thread,
    open: false,
    dismissed: false,
    selectedId: '',
    width: 620,
    view: 'browser',
  };
  try {
    const stored = JSON.parse(sessionStorage.getItem(`pitchcrew.browser.${thread}`) ?? 'null');
    return stored &&
      typeof stored.open === 'boolean' &&
      typeof stored.dismissed === 'boolean' &&
      typeof stored.selectedId === 'string'
      ? {
          ...fallback,
          open: stored.open,
          dismissed: stored.dismissed,
          selectedId: stored.selectedId,
          width:
            typeof stored.width === 'number' ? Math.max(360, Math.min(1000, stored.width)) : 620,
          view: stored.view === 'packet' ? 'packet' : 'browser',
        }
      : fallback;
  } catch {
    return fallback;
  }
};
export const useBrowserPanel = (
  data: Snapshot,
  thread: string,
  participants: string[],
  readOnly: boolean,
  preferredRoleId?: string,
) => {
  const participantIds = new Set(participants);
  const roles = data.roles.filter(
    (role) => participantIds.has(role.id) && role.capabilities?.computerUse && !role.retiredAt,
  );
  const enabled = !readOnly && roles.length > 0;
  const status = useBrowserSessions(thread, enabled);
  const [preference, setPreference] = useState(() => readPreference(thread));
  if (preference.thread !== thread) setPreference(readPreference(thread));
  const state = preference.thread === thread ? preference : readPreference(thread);
  const role =
    roles.find((agent) => agent.id === (state.selectedId || preferredRoleId)) ?? roles[0];
  const active = status.sessions.find((session) => session.runId && session.status === 'open');
  if (preference.thread === thread && active && !state.open && !state.dismissed)
    setPreference({
      ...state,
      open: true,
      view: 'browser',
      selectedId: state.selectedId || active.roleId,
    });
  useEffect(() => {
    try {
      sessionStorage.setItem(`pitchcrew.browser.${state.thread}`, JSON.stringify(state));
    } catch {
      /* Preferences are optional. */
    }
  }, [state]);
  return {
    roles,
    role,
    sessions: status.sessions,
    error: status.error,
    refresh: status.refresh,
    session: status.sessions.find((item) => item.roleId === role?.id),
    available: enabled,
    open: enabled && state.open,
    width: state.width,
    /** Whether the shared right panel shows the browser or the packet. */
    view: state.view,
    /** An agent run is using a browser (plum); the user's own browsing is not activity. */
    activity: status.sessions.some((item) => !!item.runId),
    show: () =>
      setPreference({
        ...state,
        open: true,
        dismissed: false,
        view: 'browser',
        selectedId: state.selectedId || active?.roleId || role?.id || '',
      }),
    showPacket: () =>
      setPreference({
        ...state,
        open: true,
        dismissed: false,
        view: 'packet',
        selectedId: state.selectedId || active?.roleId || role?.id || '',
      }),
    setView: (view: BrowserPanelView) => setPreference((current) => ({ ...current, view })),
    hide: () => {
      setPreference({ ...state, open: false, dismissed: true });
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>('button[aria-controls="agent-browser-panel"]')
          ?.focus(),
      );
    },
    select: (selectedId: string) => setPreference((current) => ({ ...current, selectedId })),
    resize: (width: number) => setPreference((current) => ({ ...current, width })),
  };
};
