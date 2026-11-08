import { useBrowserPresenceField } from '@/DesktopBrowserHost/presence.ts';
import { chatRole, chatRoleState } from '../model.ts';
import { queuedChatRequests } from '../helpers.ts';
import { useBrowserPanel } from '@/AgentBrowser/hooks/useBrowserPanel.ts';
import { useChatPanels } from './useChatPanels.ts';
import { useChatAttachments } from './useChatAttachments.ts';
import { useChatPreferences } from './useChatPreferences.ts';
import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import type { ChatViewProps } from '@/ChatView/types.ts';
import type { ChatMessage } from '@pitchcrew/core';
import { useMemo, useRef, useState } from 'react';
import { focusAfterReveal, questionReturnFocus } from '@/UserQuestions/focus.ts';
import type { QuestionFocusIntent } from '@/UserQuestions/types.ts';
import {
  collapseQuestions,
  emptyQuestionSelection,
  pendingQuestionId,
  useQuestionState,
} from '@/UserQuestions/question-state.ts';
import { useQuestionSelection } from '@/UserQuestions/hooks/useQuestionSelection.ts';
import { useQuestionLifecycle } from '@/UserQuestions/hooks/useQuestionLifecycle.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useComposerDraft } from './useComposerDraft.ts';
import { sendComposerDraft } from '../composer-send.ts';
import { effectiveComposerMode } from '../composer-retry.ts';

export const useChatView = (props: ChatViewProps) => {
  const { thread, action, working } = props;
  const runs = useMemo(() => {
    const runsById = new Map(props.data.runs.map((run) => [run.id, run]));
    for (const run of props.data.activityRuns ?? [])
      runsById.set(run.id, { ...runsById.get(run.id), ...run });
    return [...runsById.values()];
  }, [props.data.runs, props.data.activityRuns]);
  const data = useMemo(() => ({ ...props.data, runs }), [props.data, runs]);
  useQuestionLifecycle(data.userInputs);
  const reduced = useAppReducedMotion();
  const inputRef = useRef<HTMLDivElement>(null);
  const composerDraft = useComposerDraft(thread);
  const [recipient, setRecipient] = useState('');
  const [panes, setPanes] = useState<Record<string, 'conversation' | 'work'>>({});
  const pane = panes[thread] ?? 'conversation';
  const setPane = (next: 'conversation' | 'work') =>
    setPanes((current) => ({ ...current, [thread]: next }));
  const panels = useChatPanels(thread);
  const [error, setError] = useState('');
  const questions = (data.userInputs ?? []).filter(
    (question) => question.threadId === thread && question.status === 'pending',
  );
  const { activeQuestionId, setActiveQuestionId } = useQuestionSelection(thread, questions);
  const writeMessage = () => {
    setPane('conversation');
    collapseQuestions(
      thread,
      questions.map((question) => question.id),
    );
    focusAfterReveal(() => inputRef.current);
  };
  const questionResolved = (id: string, intent: QuestionFocusIntent = 'text') => {
    focusAfterReveal(() => {
      if (useQuestionState.getState().recoveries[id])
        return document.getElementById(`question-response-recovery-${id}`);
      const pending = (
        useWorkspaceStore.getState().data?.userInputs ??
        data.userInputs ??
        []
      ).filter(
        (question) =>
          question.threadId === thread && question.status === 'pending' && question.id !== id,
      );
      const next = pendingQuestionId(
        pending,
        useQuestionState.getState().docks[thread] ?? emptyQuestionSelection,
      );
      if (intent === 'surface')
        return next
          ? document.querySelector<HTMLElement>(
              `[data-question-id="${next}"] .pending-question-trigger`,
            )
          : questionReturnFocus();
      return next ? document.getElementById(`answer-${next}`) : inputRef.current;
    });
  };
  const answerQuestion = (id: string) => {
    setPane('conversation');
    setActiveQuestionId(id);
    focusAfterReveal(() => document.getElementById(`answer-${id}`));
  };
  const preferences = useChatPreferences(thread, data);
  const { conversation, participants, roleId, role } = chatRole(data, thread, recipient);
  const attachments = useChatAttachments(thread, setError);
  const readOnly = conversation?.kind === 'history' || conversation?.kind === 'agent_dm';
  const browserPanel = useBrowserPanel(data, thread, participants, !!readOnly, roleId);
  const messages = useMemo(
    () =>
      [...data.messages, ...data.streamingMessages].filter(
        (message) => message.threadId === thread,
      ),
    [data.messages, data.streamingMessages, thread],
  );
  const streamingIds = new Set(data.streamingMessages.map((message) => message.id));
  const roots = new Set(
    data.runs.filter((run) => run.threadId === thread).map((run) => run.rootRunId ?? run.id),
  );
  const running = data.runs.filter(
    (run) => run.status === 'running' && roots.has(run.rootRunId ?? run.id),
  );
  const busy = data.runs.some(
    (run) =>
      run.status === 'running' &&
      (conversation?.cardId
        ? run.cardId === conversation.cardId
        : roots.has(run.rootRunId ?? run.id)),
  );
  const busyElsewhere = busy && running.length === 0;
  const available = participants.some((id) => {
    const agent = data.roles.find((entry) => entry.id === id);
    const config = { ...agent, ...conversation?.configurations[id] };
    return (
      agent?.enabled &&
      !agent.retiredAt &&
      data.runtimes.some((runtime) => runtime.id === config?.runtime && runtime.available)
    );
  });
  const cardId = conversation?.cardId ?? '';
  const attached = data.cards.find((card) => card.id === cardId);
  const queued = queuedChatRequests(data.chatRequests ?? [], thread);
  const participantIds = new Set(participants);
  const proposals = data.proposals.filter(
    (proposal) =>
      (participantIds.has(proposal.roleId) || participantIds.has(proposal.sourceRoleId ?? '')) &&
      proposal.status === 'pending',
  );
  const skillProposals = data.skillProposals.filter(
    (proposal) => proposal.threadId === thread && proposal.status === 'pending',
  );
  const tasks = data.tasks
    .filter((task) => task.threadId === thread || roots.has(task.rootRunId))
    .slice(-12)
    .reverse();
  const rounds = (data.delegationRounds ?? [])
    .filter(
      (round) =>
        round.threadId === thread ||
        roots.has(round.rootRunId) ||
        round.delegates.some((delegate) => delegate.threadId === thread),
    )
    .slice(-6)
    .reverse();
  const attention =
    proposals.length +
    skillProposals.length +
    tasks.filter((task) => ['queued', 'running'].includes(task.status)).length +
    rounds.filter((round) => !['completed', 'cancelled'].includes(round.status)).length;
  const approving = data.computerApprovals.some(
    (approval) => approval.status === 'pending' && running.some((run) => run.id === approval.runId),
  );
  const heldRun = useBrowserPresenceField('heldRun');
  const held = running.some((run) => run.id === heldRun);
  const roleState = chatRoleState(data, role, questions, busy, approving, held);
  const name = (id: ChatMessage['from'] | ChatMessage['to']) =>
    id === 'user'
      ? 'You'
      : id === 'crew'
        ? 'Group'
        : id === 'system'
          ? 'Pitchcrew'
          : (data.roles.find((agent) => agent.id === id)?.name ?? id);
  const patchConversation = async (patch: unknown) => {
    try {
      await action(`/conversations/${thread}`, 'PUT', patch);
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update the conversation.');
      return false;
    }
  };
  const applyStarter = (prompt: string) => {
    composerDraft.offerDraft(thread, prompt);
    inputRef.current?.focus();
  };
  const send = async (text: string, intent: 'queue' | 'interrupt' = 'queue') => {
    if (
      (!text.trim() && !attachments.files.length) ||
      working ||
      composerDraft.sending ||
      readOnly ||
      !available
    )
      return;
    if (text.trim().length > 8000) {
      setError('Messages can contain at most 8,000 characters.');
      return;
    }
    setPane('conversation');
    setError('');
    await sendComposerDraft(thread, action, { intent });
  };

  const sendDelegation = async (text: string, roleIds: string[]) => {
    if (
      !text.trim() ||
      !roleIds.length ||
      working ||
      composerDraft.sending ||
      readOnly ||
      !available
    )
      return false;
    if (text.trim().length > 8000) {
      setError('Messages can contain at most 8,000 characters.');
      return false;
    }
    setPane('conversation');
    setError('');
    return sendComposerDraft(thread, action, { roleIds });
  };

  return {
    ...props,
    data,
    browserPanel,
    questions,
    activeQuestionId,
    setActiveQuestionId,
    answerQuestion,
    writeMessage,
    questionResolved,
    ...attachments,
    ...preferences,
    reduced,
    inputRef,
    ...composerDraft,
    sendMode: effectiveComposerMode(preferences.sendMode, composerDraft.retryMode),
    setSendMode: (mode: 'queue' | 'interrupt') => {
      if (!composerDraft.retryMode) preferences.setSendMode(mode);
    },
    recipient: roleId,
    setRecipient,
    pane,
    setPane,
    ...panels,
    error,
    setError,
    roleId,
    role,
    streamingIds,
    messages,
    running,
    busy,
    busyElsewhere,
    available,
    cardId,
    proposals,
    skillProposals,
    tasks,
    rounds,
    attention,
    attached,
    roleState,
    name,
    applyStarter,
    send,
    sendDelegation,
    conversation,
    participants,
    readOnly,
    queued,
    patchConversation,
    jobItems: [
      { value: '', label: 'Attach a job' },
      ...data.cards.map((card) => ({ value: card.id, label: `${card.company} · ${card.title}` })),
    ],
    recipientItems: participants.map((id) => ({ value: id, label: name(id) })),
  };
};
