import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Approval, Card, ChatRequest, Snapshot } from '@pitchcrew/core';
import type { CardDetailsModel } from '@/components/CardDetails/types.ts';

const store = vi.hoisted(() => ({ data: null as unknown }));
vi.mock('@/WorkspaceStore/index.ts', () => ({
  useWorkspaceStore: (select: (state: { data: unknown }) => unknown) => select(store),
}));

const { StageTrack } = await import('../components/StageTrack.tsx');
const { JobProgress } = await import('../components/JobProgress.tsx');
const { ChatStageTrack } = await import('../components/ChatStageTrack.tsx');
const { ExportRequest } = await import('@/components/CardDetails/components/ExportRequest.tsx');
const { jobNextAction } = await import('@/components/CardDetails/next-action.ts');
const { cardPacketStage } = await import('../packet-guidance.ts');
const { currentStageTone, stepLabel } = await import('../helpers.ts');
const { jobAsks } = await import('../signals.ts');

const packet = { resume: 'Resume', coverLetter: '', formAnswers: '', note: '', claims: [] };

const job = (fields: Partial<Card> = {}) =>
  ({
    id: 'job',
    company: 'Acme (fictional)',
    title: 'Engineer',
    state: 'awaiting_approval',
    fit: 80,
    location: '',
    owner: null,
    packet,
    packetReview: { runId: 'review-run', contextRevision: 'r1' },
    applicationContext: {
      revision: 'r1',
      confirmedRevision: 'r1',
      confirmedAt: '2026-11-01T00:00:00.000Z',
      requirements: [],
      createdAt: '2026-11-01T00:00:00.000Z',
    },
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...fields,
  }) as unknown as Card;

const approval = (fields: Partial<Approval> = {}) =>
  ({
    id: 'approval',
    cardId: 'job',
    action: 'export_packet',
    digest: 'd',
    packet,
    contextRevision: 'r1',
    status: 'pending',
    createdAt: '2026-11-02T00:00:00.000Z',
    decidedAt: null,
    ...fields,
  }) as Approval;

const exportedFiles = {
  status: 'consumed',
  decidedAt: '2026-11-02T01:00:00.000Z',
  exportDirectory: '/fictional/exports/acme',
} as const;

const fixtures = {
  pending: approval(),
  approved: approval({ status: 'approved', decidedAt: '2026-11-02T01:00:00.000Z' }),
  manual: approval({ ...exportedFiles, submission: { method: 'manual' } }),
  agent: approval({
    ...exportedFiles,
    submission: { method: 'agent', roleId: 'submitter', requestId: 'prep' },
  } as Partial<Approval>),
};

const snapshot = (approvals: Approval[], fields: Partial<Snapshot> = {}, card = job()) =>
  ({
    cards: [card],
    roles: [
      { id: 'reviewer', name: 'Reviewer', enabled: true },
      { id: 'submitter', name: 'Submitter', enabled: true },
    ],
    runs: [{ id: 'review-run', roleId: 'reviewer', cardId: 'job', status: 'completed' }],
    approvals,
    computerApprovals: [],
    conversations: [{ id: 'chat', cardId: 'job' }],
    ...fields,
  }) as unknown as Snapshot;

const preparation = (status: ChatRequest['deliveries'][number]['status']) =>
  ({ id: 'prep', deliveries: [{ status }] }) as unknown as ChatRequest;

const track = (data: Snapshot, card = data.cards[0]!) =>
  renderToStaticMarkup(
    createElement(StageTrack, {
      state: card.state,
      labelled: true,
      stage: cardPacketStage(card, data.approvals),
      tone: jobAsks(card.id, data) ? 'ochre' : undefined,
    }),
  );

const currentLabel = (html: string) => html.match(/data-current="">([^<]+)</)?.[1];
const currentBead = (html: string) => html.match(/data-size="sm" data-tone="([a-z]+)"/g)?.at(-1);

describe('stage 5 follows the actual approval and handoff', () => {
  it('names the stage for pending, approved, exported, agent and uncertain packets', () => {
    const cases: [Approval, Partial<Card>, string, string][] = [
      [fixtures.pending, {}, 'You approve', 'You approve'],
      [fixtures.approved, {}, 'Choose how to apply', 'Approved'],
      [fixtures.manual, {}, 'Ready to apply', 'Ready to apply'],
      [fixtures.agent, {}, 'Agent preparation', 'Preparation'],
      [
        fixtures.agent,
        {
          submissionAttempts: [{ exportApprovalId: 'approval', status: 'uncertain' }],
        } as Partial<Card>,
        'Verify submission',
        'Verify',
      ],
    ];
    for (const [item, fields, full, short] of cases) {
      const card = job(fields);
      const html = track(snapshot([item], {}, card), card);
      expect(html).toContain(`Stage 5 of 6: ${full}`);
      expect(currentLabel(html)).toBe(short);
      expect(html).not.toContain(full === 'You approve' ? 'Ready to apply' : 'You approve');
    }
  });

  it('keeps six stages and the recorded outcome labels after submission', () => {
    const html = track(snapshot([fixtures.manual], {}, job({ state: 'screening' })));
    expect(html.match(/class="clay-bead"/g)).toHaveLength(6);
    expect(html).toContain('Stage 6 of 6: Screening');
    // The passed approval step is a phase name, not an instruction; a future one still says who acts.
    expect(html).toContain('>Approval<');
    expect(html).not.toContain('You approve');
    expect(stepLabel('drafting', 4)).toBe('You approve');
    expect(stepLabel('interviewing', 5)).toBe('Interviewing');
  });

  it('falls back to You approve for an agreed packet and a stale approval', () => {
    expect(cardPacketStage(job({ state: 'agreed' }), [fixtures.manual])).toBeUndefined();
    const stale = job({ applicationContext: { ...job().applicationContext!, revision: 'r2' } });
    expect(cardPacketStage(stale, [fixtures.manual])).toBeUndefined();
    expect(track(snapshot([fixtures.manual], {}, stale), stale)).toContain(
      'Stage 5 of 6: You approve',
    );
  });

  it('uses the newest packet decision when several need the user', () => {
    const older = approval({ id: 'older', createdAt: '2026-11-01T00:00:00.000Z' });
    expect(cardPacketStage(job(), [fixtures.manual, older])).toBe('apply');
  });

  it('turns ochre only for the user’s move and plum while an agent prepares', () => {
    expect(currentBead(track(snapshot([fixtures.manual])))).toContain('ochre');
    expect(currentBead(track(snapshot([fixtures.pending])))).toContain('ochre');
    const preparing = snapshot([fixtures.agent], { chatRequests: [preparation('running')] });
    expect(jobAsks('job', preparing)).toBe(false);
    expect(currentBead(track(preparing))).toContain('current');
    expect(currentStageTone('awaiting_approval', { live: true, stage: 'preparing' })).toBe('plum');
    const paused = snapshot([fixtures.agent], { chatRequests: [preparation('paused')] });
    expect(jobAsks('job', paused)).toBe(true);
    expect(currentBead(track(paused))).toContain('ochre');
  });

  it('agrees between job details and the job chat track', () => {
    const data = snapshot([fixtures.manual]);
    const details = renderToStaticMarkup(
      createElement(JobProgress, { card: data.cards[0]!, data }),
    );
    store.data = data;
    const chat = renderToStaticMarkup(createElement(ChatStageTrack, { thread: 'chat' }));
    for (const html of [details, chat]) {
      expect(html).toContain('Stage 5 of 6: Ready to apply');
      expect(html).not.toContain('You approve');
    }
    expect(chat).toMatch(/aria-hidden="true"><\/span>Ready to apply<\/span>/);
  });
});

const model = (card: Card, data: Snapshot, patch: Partial<CardDetailsModel> = {}) =>
  ({
    card,
    data: { ...data, runtimes: [], profile: [] },
    brief: { loaded: { context: {} }, confirmed: true, draft: { requirements: [] } },
    agents: [],
    exported: true,
    busy: false,
    act: vi.fn(),
    openApplication: vi.fn(),
    setTab: vi.fn(),
    openInbox: vi.fn(),
    ...patch,
  }) as unknown as CardDetailsModel;

describe('job details footer at the handoff', () => {
  it('continues the application in Decisions and keeps recording secondary', () => {
    const next = model(job(), snapshot([fixtures.manual]));
    const action = jobNextAction(next);
    expect(action.label).toBe('Continue application');
    expect(action.hint).toContain('Nothing has been sent');
    expect(action.hint).toContain('only after you have applied');
    action.perform();
    expect(next.openInbox).toHaveBeenCalledOnce();
    expect(next.act).not.toHaveBeenCalled();
    const [record] = action.alternates ?? [];
    expect(record?.label).toBe('Record manual submission');
    record?.perform();
    expect(next.act).toHaveBeenCalledWith(
      '/cards/job/move',
      { state: 'submitted' },
      'Recorded your manual submission',
    );
  });

  it('never offers recording while an agent prepares, and words an approved packet', () => {
    const preparing = jobNextAction(model(job(), snapshot([fixtures.agent])));
    expect(preparing.label).toBe('Continue application');
    expect(preparing.alternates).toBeUndefined();
    expect(preparing.hint).toContain('Nothing is submitted until you approve');
    const approved = model(job(), snapshot([fixtures.approved]), { exported: false });
    expect(jobNextAction(approved)).toMatchObject({
      label: 'Continue application',
      hint: expect.stringContaining('Choose how to apply'),
    });
    expect(
      jobNextAction(model(job(), snapshot([fixtures.pending]), { exported: false })).label,
    ).toBe('Open in Decisions');
    const uncertain = job({
      submissionAttempts: [{ exportApprovalId: 'approval', status: 'uncertain' }],
    } as Partial<Card>);
    expect(jobNextAction(model(uncertain, snapshot([fixtures.agent], {}, uncertain))).label).toBe(
      'Verify submission',
    );
  });
});

describe('one primary export request', () => {
  const choices = {
    suggestion: { format: 'pdf', reason: 'PDF suits this form.' },
    format: 'docx',
    layout: 'formatted',
    requesting: false,
    setFormat: vi.fn(),
    setLayout: vi.fn(),
    request: vi.fn(),
  } as never;
  it('leaves the request to the footer while it offers the same choices', () => {
    const html = renderToStaticMarkup(
      createElement(ExportRequest, { choices, working: false, footer: true }),
    );
    expect(html).not.toContain('Request export approval</button>');
    expect(html).toContain('Request export approval below');
  });
  it('keeps a quiet outline request otherwise', () => {
    const html = renderToStaticMarkup(
      createElement(ExportRequest, { choices, working: false, footer: false }),
    );
    expect(html).toContain('Request export approval');
    expect(html).not.toContain('button primary');
  });
});
