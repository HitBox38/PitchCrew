import { useChatPanels } from './useChatPanels.ts';
import { useChatAttachments } from './useChatAttachments.ts';
import { useChatPreferences } from './useChatPreferences.ts';
import { encodeAttachment } from '../api.ts';
import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import type { ChatViewProps } from '@/ChatView/types.ts';
import type { ChatMessage } from '@pitchcrew/core';
import { useRef, useState } from 'react';

export function useChatView(props: ChatViewProps) {
  const { data, thread, action, working } = props;
  const reduced = useAppReducedMotion();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [recipient, setRecipient] = useState('');
  const [panes, setPanes] = useState<Record<string, 'conversation' | 'work'>>({});
  const pane = panes[thread] ?? 'conversation';
  const setPane = (next: 'conversation' | 'work') =>
    setPanes((current) => ({ ...current, [thread]: next }));
  const panels = useChatPanels(thread);
  const [error, setError] = useState('');
  const [activeQuestions, setActiveQuestions] = useState<Record<string, string>>({});
  const activeQuestionId = activeQuestions[thread];
  const setActiveQuestionId = (id: string) =>
    setActiveQuestions((current) => ({ ...current, [thread]: id }));
  const questions = (data.userInputs ?? []).filter(
    (question) => question.threadId === thread && question.status === 'pending',
  );
  const answerQuestion = (id: string) => {
    setPane('conversation');
    setActiveQuestionId(id);
    requestAnimationFrame(() => document.getElementById(`answer-${id}`)?.focus());
  };
  const sendingRef = useRef(false);
  const preferences = useChatPreferences(thread, data);
  const conversation = data.conversations?.find((item) => item.id === thread);
  const participants = conversation?.participants ?? [thread];
  const roleId = participants.includes(recipient)
    ? recipient
    : (conversation?.leadId ?? participants[0] ?? data.roles[0].id);
  const savedRole = data.roles.find((item) => item.id === roleId) ?? data.roles[0];
  const role = { ...savedRole, ...conversation?.configurations[roleId] };
  const attachments = useChatAttachments(thread, setError);
  const readOnly = conversation?.kind === 'history' || conversation?.kind === 'agent_dm';
  const messages = [...data.messages, ...data.streamingMessages].filter(
    (message) => message.threadId === thread,
  );
  const streamingIds = new Set(data.streamingMessages.map((message) => message.id));
  const roots = new Set(
    data.runs.filter((run) => run.threadId === thread).map((run) => run.rootRunId ?? run.id),
  );
  const running = data.runs.filter(
    (run) => run.status === 'running' && roots.has(run.rootRunId ?? run.id),
  );
  const busy = data.runs.some(
    (run) => participants.includes(run.roleId) && run.status === 'running',
  );
  const busyElsewhere = data.runs.some(
    (run) =>
      participants.includes(run.roleId) && run.status === 'running' && run.threadId !== thread,
  );
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
  const queued = (data.chatRequests ?? [])
    .filter(
      (request) =>
        request.threadId === thread &&
        request.deliveries.some((delivery) =>
          ['queued', 'paused', 'running', 'failed'].includes(delivery.status),
        ),
    )
    .sort((a, b) => a.order - b.order);
  const proposals = data.proposals.filter(
    (proposal) =>
      (participants.includes(proposal.roleId) ||
        participants.includes(proposal.sourceRoleId ?? '')) &&
      proposal.status === 'pending',
  );
  const skillProposals = data.skillProposals.filter(
    (proposal) => proposal.threadId === thread && proposal.status === 'pending',
  );
  const tasks = data.tasks
    .filter((task) => task.threadId === thread || roots.has(task.rootRunId))
    .slice(-12)
    .reverse();
  const attention =
    proposals.length +
    skillProposals.length +
    tasks.filter((task) => ['queued', 'running'].includes(task.status)).length;
  const roleState = role.retiredAt
    ? 'Retired'
    : !role.enabled
      ? 'Paused'
      : !data.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available)
        ? 'Unavailable'
        : questions.some((question) => question.roleId === roleId)
          ? 'Waiting for you'
          : busy
            ? 'Working'
            : 'Ready';
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
    setDrafts((current) => ({ ...current, [thread]: prompt }));
    inputRef.current?.focus();
  };
  async function send(text: string, intent: 'queue' | 'interrupt' = 'queue') {
    if (
      (!text.trim() && !attachments.files.length) ||
      working ||
      sendingRef.current ||
      readOnly ||
      !available
    )
      return;
    const sentThread = thread;
    setPane('conversation');
    setError('');
    sendingRef.current = true;
    try {
      await action(`/conversations/${thread}/messages`, 'POST', {
        content: text,
        attachments: await Promise.all(attachments.files.map(encodeAttachment)),
        intent,
      });
      setDrafts((current) => ({ ...current, [sentThread]: '' }));
      attachments.clearFiles(sentThread);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not send the message.');
    } finally {
      sendingRef.current = false;
    }
  }
  return {
    ...props,
    questions,
    activeQuestionId,
    setActiveQuestionId,
    answerQuestion,
    ...attachments,
    ...preferences,
    reduced,
    inputRef,
    setDrafts,
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
    draft: drafts[thread] ?? '',
    cardId,
    proposals,
    skillProposals,
    tasks,
    attention,
    attached,
    roleState,
    name,
    applyStarter,
    send,
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
}
