import {
  defaultCapabilities,
  roleChanges,
  skillInput,
  type AgentTask,
  type Card,
  type ChatMessage,
  type ChatRequest,
  type Role,
  type RoleProposal,
  type Run,
  type RunActivity,
  type SkillProposal,
  type UserInputRequest,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { saveRequest } from './conversation-queue.ts';
import { createConversation } from './conversations.ts';
import type { CrewContext } from './types.ts';

type Step = Pick<RunActivity, 'kind' | 'label' | 'status'> & { text?: string };

/**
 * A fictional job conversation that shows every chat state at once: finished turns with a failed
 * step, a question waiting on the user, queued, paused and failed messages, crew follow-ups and a
 * pending role and skill proposal. Nothing here launches a run; the waiting question holds the
 * queued message, and the proposals wait for an ordinary user decision.
 */
export const loadChatExamples = (context: CrewContext, card: Card): void => {
  const roles = context.board.list<Role>('role');
  const writer = roles.find((role) => role.id === 'writer');
  const reviewer = roles.find((role) => role.id === 'reviewer');
  if (!writer || !reviewer) return;
  const thread = createConversation(context, {
    title: `${card.company} packet review`,
    participants: ['writer', 'reviewer'],
    cardId: card.id,
  });
  const start = Date.now() - 40 * 60_000;
  const at = (minutes: number) => new Date(start + minutes * 60_000).toISOString();
  const message = (
    minute: number,
    from: ChatMessage['from'],
    to: ChatMessage['to'],
    content: string,
    runId: string | null,
    extra: Partial<ChatMessage> = {},
  ) => {
    const item: ChatMessage = {
      id: randomUUID(),
      threadId: thread.id,
      from,
      to,
      content,
      cardId: card.id,
      runId,
      createdAt: at(minute),
      ...extra,
    };
    context.board.record('message', item, from, 'Example conversation message');
    return item;
  };
  const run = (
    role: Role,
    minute: number,
    length: number,
    status: Run['status'],
    steps: Step[],
  ): Run => {
    const item: Run = {
      id: randomUUID(),
      cardId: card.id,
      roleId: role.id,
      runtime: role.runtime,
      status,
      message: status === 'waiting' ? 'Waiting for your answer' : 'Replied',
      startedAt: at(minute),
      finishedAt: status === 'waiting' ? null : at(minute + length),
      mode: 'chat',
      threadId: thread.id,
      activity: steps.map((step, index) => ({
        ...step,
        id: randomUUID(),
        startedAt: at(minute + (index * length) / steps.length),
        finishedAt: at(minute + ((index + 1) * length) / steps.length),
      })),
    };
    context.board.record('run', item, role.id, 'Example chat turn');
    return item;
  };

  const first = run(writer, 1, 3, 'completed', [
    {
      kind: 'commentary',
      label: 'Update',
      status: 'completed',
      text: 'I’ll compare the cover letter with your profile before I change anything.',
    },
    { kind: 'tool', label: 'Reading the packet', status: 'completed' },
    { kind: 'tool', label: 'Checking profile evidence', status: 'completed' },
    { kind: 'tool', label: 'Running packet rules', status: 'failed' },
    { kind: 'tool', label: 'Running packet rules again', status: 'completed' },
  ]);
  message(
    0,
    'user',
    'writer',
    'Can you tighten the cover letter opening before I approve it?',
    first.id,
  );
  message(
    4,
    'writer',
    'user',
    'I shortened the opening to two sentences and led with the design-system work from your profile. The packet rules pass on the second check.',
    first.id,
  );
  const second = run(reviewer, 6, 2, 'completed', [
    { kind: 'tool', label: 'Checking claims against your profile', status: 'completed' },
    { kind: 'tool', label: 'Comparing with the job brief', status: 'completed' },
  ]);
  message(5, 'user', 'reviewer', 'Reviewer, does the new opening still hold up?', second.id);
  message(
    8,
    'reviewer',
    'user',
    'Every claim in the new opening matches a line in your profile. I have nothing blocking.',
    second.id,
  );

  const asking = run(writer, 11, 1, 'waiting', [
    { kind: 'tool', label: 'Reading the salary note', status: 'completed' },
  ]);
  message(10, 'user', 'writer', 'Should we say anything about salary?', asking.id);
  const question: UserInputRequest = {
    id: randomUUID(),
    threadId: thread.id,
    sourceThreadId: thread.id,
    roleId: writer.id,
    runId: asking.id,
    messageId: randomUUID(),
    cardId: card.id,
    createdAt: at(12),
    status: 'pending',
    question: 'Should the cover letter mention your salary expectations?',
    reason: 'The posting asks for them, but your profile keeps them for the recruiter call.',
    continuationNotes: '',
    options: [
      { id: 'mention', label: 'Mention a range', description: 'Use the range in your profile.' },
      { id: 'later', label: 'Leave it for the call', description: '' },
    ],
    multiSelect: false,
  };
  context.board.record('user_input', question, writer.id, 'Example question');
  message(12, 'writer', 'user', question.question, asking.id, {
    id: question.messageId,
    notification: 'attention',
    userInput: { id: question.id, kind: 'question' },
  });

  const queued = (
    minute: number,
    roleId: string,
    content: string,
    status: ChatRequest['deliveries'][number]['status'],
    error = '',
  ) => {
    const request: ChatRequest = {
      id: randomUUID(),
      threadId: thread.id,
      messageId: randomUUID(),
      content,
      attachments: [],
      createdAt: at(minute),
      order: Date.now() + minute,
      deliveries: [{ roleId, status, runId: null, error }],
    };
    message(minute, 'user', roleId, content, null, { id: request.messageId });
    saveRequest(context, request);
  };
  queued(14, 'writer', 'Also shorten the closing paragraph.', 'queued');
  queued(15, 'reviewer', 'Recheck the closing once Writer revises it.', 'paused');
  queued(
    16,
    'reviewer',
    'Confirm the portfolio link still opens.',
    'failed',
    'Reviewer stopped before replying.',
  );

  const task = (
    minute: number,
    roleId: string,
    content: string,
    status: AgentTask['status'],
    error = '',
  ) =>
    context.board.record(
      'task',
      {
        id: randomUUID(),
        parentRunId: first.id,
        rootRunId: first.id,
        roleId,
        cardId: card.id,
        mode: 'chat',
        trigger: 'message',
        threadId: thread.id,
        content,
        status,
        runId: null,
        error,
        createdAt: at(minute),
      } satisfies AgentTask,
      'writer',
      'Example crew follow-up',
    );
  task(4, 'reviewer', 'Check the new cover letter opening against the profile.', 'completed');
  task(
    5,
    'reviewer',
    `Open the ${card.company} careers page to confirm the team name.`,
    'failed',
    'The page did not load before the deadline.',
  );
  task(9, 'writer', 'Revise the closing after the salary answer.', 'cancelled', 'Stopped by you.');

  loadProposalExamples(context, { thread: thread.id, writer, reviewer, at, first, second });
};

type ProposalExampleInput = {
  thread: string;
  writer: Role;
  reviewer: Role;
  at: (minute: number) => string;
  first: Run;
  second: Run;
};

/** Records the same pending shapes the scoped proposal tools produce, with matching chat notes. */
const loadProposalExamples = (
  context: CrewContext,
  { thread, writer, reviewer, at, first, second }: ProposalExampleInput,
): void => {
  const proposal: RoleProposal = {
    id: randomUUID(),
    roleId: writer.id,
    runId: first.id,
    reason:
      'Packet rules failed on my first check today because I ran them after rewriting. Checking them before I reply, and reading past applications for tone, would save you a round of review.',
    changes: roleChanges.parse({
      instructions: `${writer.instructions.trim()}\n\nRun the packet rules before every reply that changes a document, and fix any errors first.`,
      capabilities: { ...(writer.capabilities ?? defaultCapabilities), readApplications: true },
    }),
    status: 'pending',
    createdAt: at(4.5),
  };
  context.board.record(
    'proposal',
    proposal,
    writer.id,
    `${writer.name} proposed changes to its settings`,
  );
  const skill = skillInput.parse({
    name: 'Cover letter openings',
    description: 'Open with one verified result that matches the job brief.',
    content: [
      '# Cover letter openings',
      '',
      '- Lead with one result from the verified profile that answers the brief’s first requirement.',
      '- Keep the opening to two sentences and name the team when the posting does.',
      '- Never add a number, title or employer that the profile does not state exactly.',
    ].join('\n'),
    scope: 'roles',
    roleIds: [writer.id, reviewer.id],
  });
  const suggestion: SkillProposal = {
    id: randomUUID(),
    roleId: reviewer.id,
    runId: second.id,
    threadId: thread,
    reason:
      'Writer and I agreed on how the opening should work; saving it keeps future packets consistent.',
    skill,
    status: 'pending',
    skillId: null,
    createdAt: at(8.5),
  };
  context.board.record(
    'skill_proposal',
    suggestion,
    reviewer.id,
    `${reviewer.name} suggested adding skill: ${skill.name}`,
  );
  context.board.record(
    'message',
    {
      id: randomUUID(),
      threadId: thread,
      from: reviewer.id,
      to: 'user',
      content: `I suggest adding the skill “${skill.name}”. ${suggestion.reason}\n\nReview its instructions and assignment in Crew work before adding it.`,
      cardId: first.cardId,
      runId: second.id,
      createdAt: suggestion.createdAt,
    } satisfies ChatMessage,
    reviewer.id,
    'Example conversation message',
  );
};
