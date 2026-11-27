import type {
  AgentTask,
  Approval,
  Card,
  ChatRequest,
  ComputerApproval,
  InstructionUpdate,
  Packet,
  ProfileMaintenanceProposal,
  RemoteMcpRequest,
  Role,
  RoleProposal,
  Run,
  Skill,
  SkillProposal,
  Snapshot,
  SubmissionAttempt,
  TrackingSignal,
  UserInputRequest,
  WorkQueueView,
} from '@pitchcrew/core';

// Fictional snapshot builders for the attention, label and "since" unit tests.

/** Every fixture's "now": Wednesday 18 November 2026, 09:00 UTC. */
export const now = Date.parse('2026-11-18T09:00:00.000Z');
/** An instant `minutes` before `now` (negative: after it). */
export const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

const names: Record<string, string> = {
  scout: 'Scout',
  writer: 'Writer',
  reviewer: 'Reviewer',
  submitter: 'Submitter',
  tracker: 'Tracker',
  'pipeline-coach': 'Pipeline Coach',
};
export const roles = Object.entries(names).map(
  ([id, name]) =>
    ({
      id,
      name,
      description: `${name} role.`,
      runtime: 'demo',
      model: '',
      enabled: true,
      instructions: `${name} keeps every claim sourced.`,
    }) as Role,
);

export const card = (id: string, fields: Partial<Card> = {}): Card => ({
  id,
  company: id,
  title: 'Frontend Engineer',
  location: 'Remote',
  url: '',
  salary: '',
  description: '',
  tags: [],
  state: 'lead',
  fit: null,
  owner: null,
  packet: null,
  feedback: [],
  createdAt: ago(2000),
  updatedAt: ago(600),
  sample: false,
  ...fields,
});

type Context = NonNullable<Card['applicationContext']>;
/** An extracted brief the user has not confirmed. */
export const brief = (fields: Partial<Context> = {}): Context => ({
  brief: {
    companyContext: 'Fictional.',
    responsibilities: [],
    qualifications: [],
    constraints: [],
  },
  requirements: [],
  flagged: [],
  sourceRevision: 'source-1',
  revision: 'brief-1',
  visibility: 'unknown',
  createdAt: ago(300),
  provenance: 'extraction',
  ...fields,
});
/** A brief confirmed at its current revision. */
export const confirmed = (fields: Partial<Context> = {}) =>
  brief({ confirmedAt: ago(200), confirmedRevision: fields.revision ?? 'brief-1', ...fields });

export const run = (id: string, fields: Partial<Run> = {}): Run => ({
  id,
  cardId: null,
  roleId: 'writer',
  runtime: 'demo',
  status: 'running',
  message: 'Working',
  startedAt: ago(10),
  finishedAt: null,
  ...fields,
});

export const request = (id: string, fields: Partial<ChatRequest> = {}): ChatRequest => ({
  id,
  threadId: `t-${id}`,
  messageId: `m-${id}`,
  content: '',
  attachments: [],
  createdAt: ago(60),
  order: 1,
  deliveries: [],
  ...fields,
});

type Delivery = ChatRequest['deliveries'][number];
export const delivery = (roleId: string, status: Delivery['status'], runId: string | null = null) =>
  ({
    roleId,
    status,
    runId,
    error: status === 'failed' ? `${names[roleId]} stopped.` : '',
  }) as Delivery;

export const queue = (id: string, fields: Partial<WorkQueueView> = {}): WorkQueueView => ({
  id,
  cardId: id.startsWith('job:') ? id.slice(4) : null,
  threadId: `t-${id}`,
  order: 1,
  paused: false,
  reason: '',
  updatedAt: ago(1),
  title: id,
  state: 'ready',
  requests: [],
  runs: [],
  tasks: [],
  ...fields,
});

export const snapshot = (fields: Partial<Snapshot> = {}): Snapshot =>
  ({
    cards: [],
    roles,
    skills: [],
    skillProposals: [],
    runs: [],
    approvals: [],
    computerApprovals: [],
    events: [],
    profile: [],
    runtimes: [],
    dataDirectory: '',
    demoAvailable: true,
    messages: [],
    streamingMessages: [],
    proposals: [],
    tasks: [],
    routines: [],
    connectors: [],
    starterSkillErrors: [],
    conversations: [],
    chatRequests: [],
    userInputs: [],
    trackingSignals: [],
    profileProposals: [],
    instructionUpdates: [],
    queue: { concurrency: 5, active: 0, background: 0, queues: [] },
    ...fields,
  }) as Snapshot;

export const browserApproval = (id: string, fields: Partial<ComputerApproval> = {}) =>
  ({
    id,
    runId: 'run-submit',
    roleId: 'submitter',
    cardId: 'initech',
    action: { kind: 'click', selector: '#submit', purpose: 'submission' },
    reason: 'Submit the application',
    page: {
      url: 'https://jobs.example.com/initech/apply',
      title: 'Apply',
      text: 'Fictional form.',
      screenshot: '',
      digest: 'page',
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
    digest: 'action',
    status: 'pending',
    error: '',
    createdAt: ago(4),
    decidedAt: null,
    ...fields,
  }) as ComputerApproval;

export const question = (id: string, fields: Partial<UserInputRequest> = {}) =>
  ({
    id,
    threadId: 't-umbra',
    sourceThreadId: 't-umbra',
    roleId: 'writer',
    runId: 'run-ask',
    messageId: `m-${id}`,
    cardId: 'umbra',
    question: 'Which project should lead the cover letter?',
    reason: '',
    continuationNotes: '',
    options: [
      { id: 'design', label: 'Design systems', description: '' },
      { id: 'speed', label: 'Performance work', description: '' },
    ],
    multiSelect: false,
    createdAt: ago(25),
    status: 'pending',
    ...fields,
  }) as UserInputRequest;

export const signal = (id: string, fields: Partial<TrackingSignal> = {}) =>
  ({
    id,
    roleId: 'tracker',
    runId: 'run-track',
    account: 'fictional@example.invalid',
    source: 'gmail',
    messageId: `msg-${id}`,
    threadId: `gmail-${id}`,
    subject: 'Next steps',
    from: 'recruiting@bluefin.example',
    quote: 'We would like to schedule a screening call.',
    sourceText: 'We would like to schedule a screening call.',
    sourceTruncated: false,
    effectiveAt: ago(108),
    createdAt: ago(100),
    company: 'Bluefin',
    title: 'Engineer',
    state: 'screening',
    candidateIds: ['bluefin'],
    expectedCards: [],
    cardId: null,
    status: 'pending',
    reason: 'Company and title match; no stable identifier.',
    ...fields,
  }) as TrackingSignal;

export const roleProposal = (id: string, fields: Partial<RoleProposal> = {}) =>
  ({
    id,
    roleId: 'writer',
    runId: 'run-propose',
    reason: 'Checking the rules first saves a review round.',
    changes: { instructions: 'Writer keeps every claim sourced.\n\nRun the packet rules first.' },
    status: 'pending',
    createdAt: ago(240),
    ...fields,
  }) as RoleProposal;

export const skillProposal = (id: string, fields: Partial<SkillProposal> = {}) =>
  ({
    id,
    roleId: 'reviewer',
    runId: 'run-skill',
    threadId: 't-crew',
    reason: 'Keeps openings consistent.',
    skill: {
      name: 'Cover letter openings',
      description: 'Open with one verified result.',
      content: '# Openings',
      scope: 'roles',
      roleIds: ['writer', 'reviewer'],
    },
    status: 'pending',
    skillId: null,
    createdAt: ago(230),
    ...fields,
  }) as SkillProposal;

export const instructionUpdate = (roleId: string, fields: Partial<InstructionUpdate> = {}) =>
  ({
    roleId,
    state: 'unedited',
    revision: 'a'.repeat(16),
    instructions: 'New default.',
    changes: [
      { revision: 'b'.repeat(16), date: '2026-11-02', summary: 'Earlier change.' },
      { revision: 'a'.repeat(16), date: '2026-11-10', summary: 'Reads the salary range first.' },
    ],
    toolDifferences: [],
    dismissed: false,
    ...fields,
  }) as InstructionUpdate;

const source = (sha: string) => ({
  url: 'https://skills.sh/example/openings',
  repository: 'example/skills',
  path: 'openings/SKILL.md',
  blobSha: sha.repeat(40),
  fetchedAt: ago(5000),
});
export const skill = (id: string, fields: Partial<Skill> = {}) =>
  ({
    id,
    name: 'Cover letter openings',
    description: 'Open with one verified result.',
    content: '# Openings',
    scope: 'all',
    roleIds: [],
    source: source('a'),
    createdAt: ago(5000),
    updatedAt: ago(5000),
    deletedAt: null,
    ...fields,
  }) as Skill;
export const skillCheck = (skillId: string, latest = 'b', dismissed?: string) => ({
  skillId,
  installed: source('a'),
  checkedAt: ago(90),
  detectedAt: ago(80),
  latest: source(latest),
  ...(dismissed ? { dismissedRevision: dismissed } : {}),
});

export const profileProposal = (id: string, fields: Partial<ProfileMaintenanceProposal> = {}) =>
  ({
    id,
    roleId: 'documenter',
    runId: 'run-profile',
    source: {
      id: 'src',
      input: { provider: 'github' },
      label: 'example/profile',
      importedAt: ago(9000),
      files: [],
    },
    baseSources: [],
    baseProfile: [],
    documents: [{ path: 'notes/work.md' }, { path: 'notes/skills.md' }],
    missing: [],
    status: 'pending',
    snapshotDigest: 'digest',
    createdAt: ago(400),
    ...fields,
  }) as unknown as ProfileMaintenanceProposal;

export const remote = (id: string, fields: Partial<RemoteMcpRequest> = {}): RemoteMcpRequest => ({
  id,
  code: 'ABCD-1234',
  name: 'Fictional Desktop',
  redirectHost: 'localhost',
  scopes: ['read'],
  createdAt: ago(2),
  expiresAt: ago(-8),
  ...fields,
});

export const pendingPacket = (id: string, cardId: string, fields: Partial<Approval> = {}) =>
  ({
    id,
    cardId,
    action: 'export_packet',
    digest: `digest-${id}`,
    packet: null,
    status: 'pending',
    createdAt: ago(70),
    decidedAt: null,
    ...fields,
  }) as unknown as Approval;

export const task = (id: string, fields: Partial<AgentTask> = {}): AgentTask => ({
  id,
  parentRunId: 'run-parent',
  rootRunId: 'run-parent',
  roleId: 'writer',
  cardId: null,
  mode: 'workflow',
  trigger: 'invoke',
  threadId: 't-task',
  content: 'Fix two claims flagged in review.',
  status: 'queued',
  runId: null,
  error: '',
  createdAt: ago(20),
  ...fields,
});

export const attempt = (id: string, cardId: string, fields: Partial<SubmissionAttempt> = {}) =>
  ({
    id,
    cardId,
    runId: 'run-attempt',
    roleId: 'submitter',
    computerApprovalId: 'approval-used',
    exportApprovalId: 'packet-used',
    packetDigest: 'digest',
    status: 'uncertain',
    before: { url: 'https://jobs.example.com/apply', title: 'Apply', text: '', digest: 'before' },
    createdAt: ago(45),
    ...fields,
  }) as SubmissionAttempt;

/** A whole packet, so components that read every document (the detector Check) render it. */
const sharedPacket = {
  resume: 'Fictional resume.',
  coverLetter: 'Fictional letter.',
  formAnswers: '',
  note: '',
  claims: [],
} as unknown as Packet;

/**
 * One snapshot holding all 17 kinds, one each. Ranked, they read: connection, browser, Profile
 * recovery · failure, verify, blocked, question · brief, packet, export · tracking · instruction
 * update, writing suggestion, Profile update, role proposal, skill proposal, skill update.
 */
export const everyKind = () => {
  const runs = [
    run('run-submit', {
      cardId: 'initech',
      roleId: 'submitter',
      threadId: 't-initech',
      startedAt: ago(18),
    }),
    run('run-corvid', {
      cardId: 'corvid',
      roleId: 'scout',
      status: 'failed',
      startedAt: ago(60),
      finishedAt: ago(50),
      purpose: 'fit',
    }),
    run('run-review', {
      cardId: 'halyard',
      roleId: 'reviewer',
      status: 'completed',
      startedAt: ago(55),
      finishedAt: ago(40),
      purpose: 'application-review',
    }),
    run('run-attempt', {
      cardId: 'fathom',
      roleId: 'submitter',
      threadId: 't-fathom',
      status: 'completed',
      startedAt: ago(50),
      finishedAt: ago(44),
    }),
    run('run-guide', {
      roleId: 'writer',
      status: 'completed',
      startedAt: ago(500),
      finishedAt: ago(490),
    }),
  ];
  const queues = [
    queue('job:initech', { state: 'running', runs: [runs[0]!] }),
    queue('job:corvid', {
      state: 'paused',
      paused: true,
      pauseKind: 'failed',
      reason: 'Scout’s fit evaluation stopped before finishing. Retry or skip this request.',
      requests: [
        request('fit-corvid', {
          boardAction: 'fit',
          content: 'Evaluate fit',
          createdAt: ago(70),
          deliveries: [delivery('scout', 'failed', 'run-corvid')],
        }),
      ],
    }),
    queue('job:umbra', {
      state: 'waiting',
      requests: [
        request('draft-umbra', {
          boardAction: 'draft',
          content: 'Draft application',
          deliveries: [delivery('writer', 'waiting', 'run-ask')],
        }),
      ],
    }),
    queue('conversation:t-prep', {
      threadId: 't-prep',
      title: 'Interview prep',
      state: 'blocked',
      reason: 'Install the assigned runtime in Settings.',
      requests: [
        request('prep', {
          threadId: 't-prep',
          content: 'Prepare questions for the panel',
          createdAt: ago(35),
          deliveries: [delivery('writer', 'queued')],
        }),
      ],
    }),
  ];
  return snapshot({
    cards: [
      card('initech', { company: 'Initech', state: 'awaiting_approval' }),
      card('umbra', { company: 'Umbra Health', state: 'drafting' }),
      card('corvid', { company: 'Corvid', applicationContext: brief() }),
      card('fathom', {
        company: 'Fathom',
        state: 'submitted',
        submissionAttempts: [attempt('attempt-1', 'fathom')],
      }),
      card('juniper', { company: 'Juniper', state: 'awaiting_approval', packet: sharedPacket }),
      card('quill', { company: 'Quill Studio', state: 'shortlisted', applicationContext: brief() }),
      card('halyard', {
        company: 'Halyard',
        state: 'agreed',
        packet: sharedPacket,
        applicationContext: confirmed(),
        packetReview: {
          contextRevision: 'brief-1',
          packetDigest: 'digest',
          runId: 'run-review',
          reviewedAt: ago(40),
        },
      }),
      card('bluefin', { company: 'Bluefin', state: 'submitted' }),
    ],
    runs,
    queue: { concurrency: 5, active: 1, background: 0, queues },
    conversations: [
      {
        id: 't-prep',
        title: 'Interview prep',
        kind: 'direct',
        participants: ['writer'],
        leadId: 'writer',
        cardId: null,
        createdBy: 'user',
        createdAt: ago(900),
        updatedAt: ago(35),
        archived: false,
        pinned: false,
        configurations: {},
      },
    ],
    computerApprovals: [browserApproval('approval-1')],
    userInputs: [question('question-1')],
    approvals: [pendingPacket('packet-1', 'juniper', { packet: sharedPacket })],
    trackingSignals: [signal('signal-1')],
    proposals: [roleProposal('proposal-1')],
    skillProposals: [skillProposal('skill-proposal-1')],
    instructionUpdates: [instructionUpdate('scout')],
    skills: [skill('skill-1')],
    skillUpdates: { automatic: true, checking: false, checks: [skillCheck('skill-1')] },
    quality: {
      writingGuide: {
        id: 'writing-guide',
        revision: 3,
        automatic: true,
        learningSince: ago(9000),
        preferences: [],
        proposals: [
          {
            id: 'writing-1',
            text: 'Prefer one concrete result per paragraph over a list of duties.',
            scope: 'all',
            reason: 'Reviewer flagged three duty lists this week.',
            roleId: 'writer',
            runId: 'run-guide',
            revision: 3,
            status: 'pending',
          },
        ],
      },
      detectors: [],
      writingCorrections: [],
      careerPlans: [],
    },
    profileProposals: [
      profileProposal('profile-1'),
      profileProposal('profile-2', { status: 'applying', decidedAt: ago(30) }),
    ],
  });
};
export const everyKindRemote = [remote('remote-1')];
