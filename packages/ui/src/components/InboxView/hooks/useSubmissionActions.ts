import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { Approval, Conversation } from '@pitchcrew/core';
import type { PacketApprovalActionsProps } from '../types.ts';
export const useSubmissionActions = ({
  approval,
  card,
  data,
  action,
}: PacketApprovalActionsProps) => {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [chooser, setChooser] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [roleId, setRoleId] = useState('submitter');
  const perform = async (operation: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await operation();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const openThread = (thread: string, agent?: string) => {
    if (agent)
      try {
        sessionStorage.setItem(
          `pitchcrew.browser.${thread}`,
          JSON.stringify({ open: true, dismissed: false, selectedId: agent, width: 620 }),
        );
      } catch {
        /* Optional preference. */
      }
    void navigate({ to: '/chat/$thread', params: { thread } });
  };
  const start = (method: 'manual' | 'agent') =>
    perform(async () => {
      const result = (await action(
        `/approvals/${approval.id}/submit`,
        'POST',
        method === 'manual' ? { method } : { method, roleId },
      )) as Approval;
      if (method === 'agent' && result.submission?.threadId)
        openThread(result.submission.threadId, result.submission.roleId);
      setChooser(false);
    });
  const askWriter = () =>
    perform(async () => {
      const writer =
        data.roles.find((role) => role.id === 'writer') ??
        data.roles.find((role) => role.workflow === 'writer');
      if (!writer) throw new Error('Create an application Writer in Crew first.');
      let thread = data.conversations?.find(
        (item) =>
          item.cardId === card.id &&
          item.participants.includes(writer.id) &&
          !['history', 'agent_dm'].includes(item.kind),
      );
      if (!thread)
        thread = (await action('/conversations', 'POST', {
          title: `${card.company}: Packet changes`.slice(0, 120),
          participants: [writer.id],
          cardId: card.id,
        })) as Conversation;
      try {
        sessionStorage.setItem(
          `pitchcrew.handoff-draft.${thread.id}`,
          `Please revise the reviewed packet (${approval.id}) for this job. Requested changes:\n\n`,
        );
      } catch {
        /* The conversation remains available. */
      }
      openThread(thread.id);
    });
  const continueApplication = () => {
    if (approval.submission?.threadId)
      openThread(approval.submission.threadId, approval.submission.roleId);
  };
  return {
    error,
    busy,
    perform,
    chooser,
    setChooser,
    roleId,
    setRoleId,
    start,
    askWriter,
    continueApplication,
    confirmWithdraw,
    setConfirmWithdraw,
  };
};
