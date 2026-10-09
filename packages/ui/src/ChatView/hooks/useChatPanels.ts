import { useCallback, useRef, useState } from 'react';
import type { RoleId } from '@pitchcrew/core';

type Panel = 'new' | 'manage' | 'runtime' | 'memory' | 'defaults' | null;
type LeaveGuard = (action: () => void) => void;

export function useChatPanels(thread: string) {
  const [state, setState] = useState<{ thread: string; dialog: Panel; agentId?: RoleId }>({
    thread,
    dialog: null,
  });
  if (state.thread !== thread) setState({ thread, dialog: null });
  const leaveGuard = useRef<LeaveGuard | null>(null);
  const registerLeaveGuard = useCallback((guard: LeaveGuard | null) => {
    leaveGuard.current = guard;
  }, []);
  const changePanel = (dialog: Panel, agentId?: RoleId) => {
    const change = () => setState({ thread, dialog, agentId });
    if (leaveGuard.current) leaveGuard.current(change);
    else change();
  };
  return {
    dialog: state.thread === thread ? state.dialog : null,
    settingsRoleId: state.agentId,
    setDialog: (dialog: Panel) => changePanel(dialog),
    onConfigure: (id: RoleId) => changePanel('defaults', id),
    closePanel: () => setState({ thread, dialog: null }),
    registerLeaveGuard,
  };
}
