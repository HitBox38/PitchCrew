import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { copyText } from '@/lib/clipboard.ts';
import { cancelJobRun, startJobWork } from '../../../api.ts';
import { canDragJob } from '../../../helpers.ts';
import { crewShortcut } from '../helpers.ts';
import type { JobActionsMenuProps } from '../types.ts';
import { useRef } from 'react';

export function useJobActionsMenu(props: JobActionsMenuProps) {
  const action = useWorkspaceStore((state) => state.action);
  const navigation = useWorkspaceNavigation();
  const { card, data, disabled, openCard, moveJob } = props;
  const shortcut = crewShortcut(card, data);
  const mutable = canDragJob(card, data) && !disabled;
  const managesFocus = useRef(false);
  const openDetails = () => {
    managesFocus.current = true;
    openCard(card.id);
  };
  const performCrew = () => {
    if (!shortcut || shortcut.reason || disabled) return;
    const kind = shortcut.draft ? 'draft' : card.state === 'lead' ? 'fit' : 'review';
    if (
      !shortcut.runId &&
      data.queue?.queues.some(
        (q) => q.cardId === card.id && q.requests.some((r) => r.boardAction === kind),
      )
    ) {
      navigation.go('queue');
      return;
    }
    if (shortcut.needsBrief) {
      managesFocus.current = true;
      useWorkspaceStore.getState().openCard(card.id, 'application');
      useWorkspaceStore
        .getState()
        .setToast('Prepare and review the application brief in job details.');
      return;
    }
    const request = shortcut.runId
      ? cancelJobRun(action, shortcut.runId)
      : shortcut.roleId
        ? startJobWork(action, card.id, shortcut.roleId, !!shortcut.draft)
        : null;
    void request?.catch(() => {});
  };
  return {
    shortcut,
    mutable,
    performCrew,
    menuOpenChange: (open: boolean) => {
      if (open) managesFocus.current = false;
    },
    finalFocus: () => !managesFocus.current,
    openDetails,
    requestDelete: () => {
      managesFocus.current = true;
      props.requestDelete(card.id);
    },
    move: (state: Parameters<typeof moveJob>[1]) => {
      managesFocus.current = true;
      void moveJob(card.id, state);
    },
    copyLink: () => copyText(card.url, 'Job posting link copied'),
  };
}
