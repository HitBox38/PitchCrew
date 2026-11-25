import { randomUUID } from 'node:crypto';
import {
  defaultCapabilities,
  roleChanges,
  type AgentTask,
  type Card,
  type CardState,
  type ChatRequest,
  type ComputerApproval,
  type Role,
  type RoleProposal,
  type Run,
  type TrackingSignal,
  type UserInputRequest,
  type WorkQueue,
} from '@pitchcrew/core';
import { jobSourceRevision, saveApplicationContext } from '../../../board/src/index.ts';
import type { CrewService } from '../../../orchestrator/src/service.ts';

/** A blank 8×6 JPEG, so the captured page draws as a real picture. */
const screenshot =
  '/9j/4AAQSkZJRgABAQAASABIAAD/wAARCAAGAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9sAQwAJCQkJCQkQCQkQFhAQEBYeFhYWFh4mHh4eHh4mLiYmJiYmJi4uLi4uLi4uNzc3Nzc3QEBAQEBISEhISEhISEhI/9sAQwELDAwSERIfEREfSzMqM0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tL/90ABAAB/9oADAMBAAIRAxEAPwD1yiiisyj/2Q==';

const extracted = {
  brief: {
    companyContext: 'A fictional employer.',
    responsibilities: ['Build accessible interfaces.'],
    qualifications: ['React and TypeScript.'],
    constraints: [],
  },
  requirements: [],
  flagged: [],
};

export type AttentionFixture = Awaited<ReturnType<typeof seedAttention>>;

/**
 * More leads with extracted briefs whose fits wait behind the cast's own, for a longer Up next
 * (every slot stays busy, so none starts). Fictional; returns their card ids in queue order.
 */
export const queueMoreFits = (service: CrewService, companies: readonly string[]) =>
  companies.map((company) => {
    const card = service.createCard({
      company,
      title: 'Frontend Engineer',
      url: `https://example.com/${company.toLowerCase().replace(/\W+/g, '-')}`,
      description: 'A fictional job.',
    });
    saveApplicationContext(service.board, card.id, jobSourceRevision(card), null, extracted, false);
    service.queueBoardAction({ cardId: card.id, action: 'fit' });
    return card.id;
  });

/**
 * Another lead whose fit stopped before it ran and paused its job queue as failed, as Corvid's did.
 * Fictional; returns its card, its queue and the failed request.
 */
export const failFit = (service: CrewService, company: string) => {
  const board = service.board;
  const card = service.createCard({
    company,
    title: 'Frontend Engineer',
    url: `https://example.com/${company.toLowerCase().replace(/\W+/g, '-')}`,
    description: 'A fictional job.',
  });
  saveApplicationContext(board, card.id, jobSourceRevision(card), null, extracted, false);
  const thread = service.createConversation({
    title: `${company}: Application work`,
    participants: ['scout'],
    cardId: card.id,
  });
  const queue: WorkQueue = {
    id: `job:${card.id}`,
    cardId: card.id,
    threadId: thread.id,
    order: Date.now(),
    paused: true,
    pauseKind: 'failed',
    reason: 'Scout’s fit evaluation stopped before finishing. Retry or skip this request.',
    updatedAt: new Date().toISOString(),
  };
  board.record('work_queue', queue, 'system', 'Fixture queue');
  const messageId = randomUUID();
  service.addMessage(thread.id, 'user', 'scout', 'Evaluate fit', card.id, null, messageId);
  const failed: ChatRequest = {
    id: randomUUID(),
    threadId: thread.id,
    messageId,
    content: 'Evaluate fit',
    attachments: [],
    boardAction: 'fit',
    mode: 'workflow',
    createdAt: new Date().toISOString(),
    order: Date.now(),
    deliveries: [
      { roleId: 'scout', status: 'failed', runId: null, error: 'Scout stopped before finishing.' },
    ],
  };
  board.record('chat_request', failed, 'system', 'Fixture failed action');
  return { cardId: card.id, queueId: queue.id, requestId: failed.id };
};

/**
 * Home's shared cast, recorded through the board while the daemon runs (agent-side records the
 * HTTP API cannot create). Five of five slots run: Halcyon (Reviewer), Initech (Submitter, holding
 * a pending submission approval), Acme Robotics (Writer), Lumen Labs (Scout) and Globex (Writer on
 * Reviewer's follow-up). Exactly six items wait on the user: the Initech browser approval, Umbra
 * Health's question, Corvid's failed fit, Bluefin's tracking review, Quill Studio's brief and
 * Writer's proposal for itself. Northwind, Kestrel AI and Tidepool wait for a slot to evaluate fit.
 * Capacity and the five runs are recorded first, so the queued fits can never start. Fictional.
 */
export const seedAttention = async (service: CrewService) => {
  const board = service.board;
  const now = Date.now();
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
  let order = 0;

  // Nothing waits on setup or on "Add your Profile notes"; Profile notes cannot change once runs start.
  service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  await service.saveProfile(
    'profile.md',
    '# Example Candidate\n\n- Built React interfaces for fictional teams.\n',
  );
  board.record('queue_settings', { id: 'workspace', concurrency: 5 }, 'user', 'Fixture capacity');

  const job = (
    company: string,
    state: CardState = 'lead',
    url = true,
    extra: Partial<Card> = {},
  ) => {
    const card = service.createCard({
      company,
      title: 'Frontend Engineer',
      url: url ? `https://example.com/${company.toLowerCase().replace(/\W+/g, '-')}` : '',
      description: 'A fictional job.',
    });
    if (state === 'lead') return card;
    return board.record('card', { ...card, state, ...extra }, 'user', 'Fixture status')
      .data as Card;
  };
  const brief = (card: Card) =>
    saveApplicationContext(board, card.id, jobSourceRevision(card), null, extracted, false);
  const lane = (card: Card, participants: string[], extra: Partial<WorkQueue> = {}) => {
    const thread = service.createConversation({
      title: `${card.company}: Application work`,
      participants,
      cardId: card.id,
    });
    const queue: WorkQueue = {
      id: `job:${card.id}`,
      cardId: card.id,
      threadId: thread.id,
      order: now + order++,
      paused: false,
      reason: '',
      updatedAt: at(1),
      ...extra,
    };
    board.record('work_queue', queue, 'system', 'Fixture queue');
    return thread.id;
  };
  const record = (run: Run) => {
    board.record('run', run, run.roleId, run.message);
    return run;
  };
  const running = (
    card: Card,
    threadId: string,
    roleId: string,
    message: string,
    minutes: number,
    extra: Partial<Run> = {},
  ) =>
    record({
      id: randomUUID(),
      cardId: card.id,
      threadId,
      roleId,
      runtime: 'demo',
      status: 'running',
      mode: 'workflow',
      message,
      startedAt: at(minutes),
      finishedAt: null,
      activity: [
        {
          id: randomUUID(),
          kind: 'tool',
          label: message,
          status: 'running',
          startedAt: at(minutes),
          finishedAt: null,
        },
      ],
      ...extra,
    });

  const halcyon = job('Halcyon', 'in_review');
  const initech = job('Initech', 'awaiting_approval');
  const acme = job('Acme Robotics', 'drafting');
  const lumen = job('Lumen Labs');
  const globex = job('Globex', 'changes_requested');
  const umbra = job('Umbra Health', 'drafting');
  const corvid = brief(job('Corvid'));
  // Submitted three days before the screening email, so the email is the newer evidence and the
  // daemon accepts Apply update (it refuses evidence older than the user's status change).
  const bluefin = job('Bluefin', 'submitted', true, { statusEffectiveAt: at(3 * 24 * 60) });
  // No posting link, so its brief asks to be checked rather than its application form.
  const quill = brief(job('Quill Studio', 'lead', false));
  service.moveCard(quill.id, 'shortlisted');
  const [northwind, kestrel, tidepool] = ['Northwind', 'Kestrel AI', 'Tidepool'].map((company) =>
    brief(job(company)),
  );

  // Working now: five job lanes hold the five slots.
  const threads = {
    halcyon: lane(halcyon, ['reviewer']),
    initech: lane(initech, ['submitter']),
    acme: lane(acme, ['writer']),
    lumen: lane(lumen, ['scout']),
    globex: lane(globex, ['writer', 'reviewer']),
  };
  const runs = {
    halcyon: running(
      halcyon,
      threads.halcyon,
      'reviewer',
      'Checking claims against your profile',
      20,
      {
        purpose: 'application-review',
      },
    ),
    initech: running(initech, threads.initech, 'submitter', 'Preparing the application form', 18, {
      mode: 'chat',
    }),
    acme: running(acme, threads.acme, 'writer', 'Drafting a focused cover letter', 12, {
      purpose: 'application-draft',
    }),
    lumen: running(lumen, threads.lumen, 'scout', 'Evaluating fit', 9, { purpose: 'fit' }),
  };
  // Globex: Writer runs Reviewer's crew follow-up from a finished review.
  const globexReview = record({
    id: randomUUID(),
    cardId: globex.id,
    threadId: threads.globex,
    roleId: 'reviewer',
    runtime: 'demo',
    status: 'completed',
    mode: 'workflow',
    purpose: 'application-review',
    message: 'Two claims need sources',
    startedAt: at(40),
    finishedAt: at(6),
  });
  const taskId = randomUUID();
  const globexRun = running(globex, threads.globex, 'writer', 'Fixing 2 claims for Reviewer', 5, {
    taskId,
    rootRunId: globexReview.id,
  });
  const followUp: AgentTask = {
    id: taskId,
    parentRunId: globexReview.id,
    rootRunId: globexReview.id,
    roleId: 'writer',
    cardId: globex.id,
    mode: 'workflow',
    trigger: 'invoke',
    threadId: threads.globex,
    content: 'Source or remove the two claims I flagged, then send it back for review.',
    status: 'running',
    runId: globexRun.id,
    error: '',
    createdAt: at(6),
  };
  board.record('task', followUp, 'reviewer', 'Fixture crew follow-up');
  const active = service.queue().active;
  if (active !== 5)
    throw new Error(`The attention fixture needs 5 of 5 slots busy, not ${active}.`);

  // The browser request on Initech's live Submitter run: a final submission.
  const approval: ComputerApproval = {
    id: randomUUID(),
    runId: runs.initech.id,
    roleId: 'submitter',
    cardId: initech.id,
    action: { kind: 'click', selector: '#submit', purpose: 'submission' },
    reason: 'Submit the fictional Initech application',
    page: {
      url: 'https://example.com/initech/apply',
      title: 'Apply · Initech (fictional)',
      text: 'Fictional application form. Submit application.',
      screenshot,
      digest: 'fixture-page',
      controls: [
        {
          selector: '#submit',
          label: 'Submit application',
          type: 'submit',
          required: false,
          visible: true,
          disabled: false,
          accept: '',
          options: [],
        },
      ],
    },
    digest: 'fixture-action',
    status: 'pending',
    error: '',
    createdAt: at(4),
    decidedAt: null,
  };
  board.record('computer_approval', approval, 'submitter', 'Fixture browser request');

  // Umbra Health: Writer's draft asked a question; a waiting run holds no slot.
  const umbraThread = lane(umbra, ['writer']);
  const umbraRequest = randomUUID();
  const asking = record({
    id: randomUUID(),
    cardId: umbra.id,
    threadId: umbraThread,
    roleId: 'writer',
    runtime: 'demo',
    status: 'waiting',
    mode: 'workflow',
    purpose: 'application-draft',
    requestId: umbraRequest,
    message: 'Waiting for your answer',
    startedAt: at(30),
    finishedAt: null,
  });
  const umbraMessage = randomUUID();
  service.addMessage(
    umbraThread,
    'user',
    'writer',
    'Draft application',
    umbra.id,
    null,
    umbraMessage,
  );
  board.record(
    'chat_request',
    {
      id: umbraRequest,
      threadId: umbraThread,
      messageId: umbraMessage,
      content: 'Draft application',
      attachments: [],
      boardAction: 'draft',
      mode: 'workflow',
      createdAt: at(31),
      order: now,
      deliveries: [{ roleId: 'writer', status: 'waiting', runId: asking.id, error: '' }],
    } satisfies ChatRequest,
    'user',
    'Fixture waiting request',
  );
  const question: UserInputRequest = {
    id: randomUUID(),
    threadId: umbraThread,
    sourceThreadId: umbraThread,
    roleId: 'writer',
    runId: asking.id,
    messageId: randomUUID(),
    cardId: umbra.id,
    question: 'Which project should lead the cover letter?',
    reason: 'Two projects match the role equally well.',
    continuationNotes: '',
    options: [
      { id: 'design', label: 'Design systems', description: '' },
      { id: 'performance', label: 'Performance work', description: '' },
    ],
    multiSelect: false,
    createdAt: at(25),
    status: 'pending',
  };
  board.record('user_input', question, 'writer', 'Fixture question');

  // Corvid: Scout's fit stopped before it ran, and paused its job queue as failed.
  const corvidThread = lane(corvid, ['scout'], {
    paused: true,
    pauseKind: 'failed',
    reason: 'Scout’s fit evaluation stopped before finishing. Retry or skip this request.',
    updatedAt: at(50),
  });
  const failedMessage = randomUUID();
  service.addMessage(corvidThread, 'user', 'scout', 'Evaluate fit', corvid.id, null, failedMessage);
  const failedRequest: ChatRequest = {
    id: randomUUID(),
    threadId: corvidThread,
    messageId: failedMessage,
    content: 'Evaluate fit',
    attachments: [],
    boardAction: 'fit',
    mode: 'workflow',
    createdAt: at(55),
    order: now + 1,
    deliveries: [
      { roleId: 'scout', status: 'failed', runId: null, error: 'Scout stopped before finishing.' },
    ],
  };
  board.record('chat_request', failedRequest, 'system', 'Fixture failed action');

  // Bluefin: an email that matches company and title, with no stable identifier.
  const signal: TrackingSignal = {
    id: randomUUID(),
    roleId: 'tracker',
    runId: randomUUID(),
    account: 'fictional@example.invalid',
    source: 'gmail',
    messageId: 'fixture-message',
    threadId: 'fixture-gmail-thread',
    subject: 'Next steps with Bluefin',
    from: 'recruiting@bluefin.example',
    quote: 'We would like to schedule a screening call.',
    sourceText: 'Hello, we would like to schedule a screening call. (fictional)',
    sourceTruncated: false,
    effectiveAt: at(108),
    createdAt: at(100),
    company: 'Bluefin',
    title: bluefin.title,
    state: 'screening',
    candidateIds: [bluefin.id],
    expectedCards: [{ id: bluefin.id, state: bluefin.state, updatedAt: bluefin.updatedAt }],
    cardId: null,
    status: 'pending',
    reason: 'Company and title match; no stable identifier.',
  };
  board.record('tracking_signal', signal, 'tracker', 'Fixture tracking review');

  // Writer proposes a change to itself while it runs, so Apply changes waits for the run.
  const writer = board.get<Role>('role', 'writer');
  const proposal: RoleProposal = {
    id: randomUUID(),
    roleId: writer.id,
    runId: runs.acme.id,
    reason:
      'Checking the packet rules before I reply, and reading past applications for tone, would save you a round of review.',
    changes: roleChanges.parse({
      instructions: `${writer.instructions.trim()}\n\nRun the packet rules before every reply that changes a document, and fix any errors first.`,
      capabilities: { ...(writer.capabilities ?? defaultCapabilities), readApplications: true },
    }),
    status: 'pending',
    createdAt: at(45),
  };
  board.record('proposal', proposal, writer.id, `${writer.name} proposed changes to its settings`);

  // Up next: three fits that wait for a slot, in this order.
  const fits = [northwind, kestrel, tidepool].map((card) =>
    service.queueBoardAction({ cardId: card.id, action: 'fit' }),
  );

  return {
    cards: {
      halcyon: halcyon.id,
      initech: initech.id,
      acme: acme.id,
      lumen: lumen.id,
      globex: globex.id,
      umbra: umbra.id,
      corvid: corvid.id,
      bluefin: bluefin.id,
      quill: quill.id,
      northwind: northwind.id,
      kestrel: kestrel.id,
      tidepool: tidepool.id,
    },
    runs: {
      halcyon: runs.halcyon.id,
      initech: runs.initech.id,
      acme: runs.acme.id,
      lumen: runs.lumen.id,
      globex: globexRun.id,
      globexReview: globexReview.id,
      umbra: asking.id,
    },
    threads: { ...threads, umbra: umbraThread, corvid: corvidThread },
    approvalId: approval.id,
    questionId: question.id,
    failedQueueId: `job:${corvid.id}`,
    failedRequestId: failedRequest.id,
    signalId: signal.id,
    proposalId: proposal.id,
    taskId,
    fitRequestIds: fits.map((request) => request.id),
  };
};
