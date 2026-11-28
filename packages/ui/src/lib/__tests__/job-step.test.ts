import { describe, expect, it } from 'vitest';
import type { Approval, Card } from '@pitchcrew/core';
import { formAssessment } from '../../../../board/test/fixtures/form.ts';
import {
  applicationFormIsCurrent,
  inspectedApplicationForm,
} from '../../../../core/src/application-form.ts';
import { jobStep, snapshotStepFacts, type JobStepFacts } from '../job-step.ts';

const ready: JobStepFacts = {
  hasBrief: true,
  briefConfirmed: true,
  formMissing: false,
  missingAnswers: false,
  exported: false,
};
const card = (fields: Partial<Card> = {}) =>
  ({ id: 'job', state: 'lead', fit: null, packet: null, url: '', ...fields }) as Card;
const context = (fields: Partial<NonNullable<Card['applicationContext']>> = {}) =>
  ({ revision: 'r1', requirements: [], ...fields }) as unknown as Card['applicationContext'];

describe('job step', () => {
  it('asks for the brief before fit, then offers the shortlist once a fit score exists', () => {
    expect(jobStep(card(), { ...ready, hasBrief: false })).toBe('prepare-brief');
    // An unconfirmed brief never holds a lead: confirmation gates drafting, not fit.
    expect(jobStep(card(), { ...ready, briefConfirmed: false })).toBe('evaluate-fit');
    expect(jobStep(card({ fit: 0 }), { ...ready, briefConfirmed: false })).toBe('shortlist');
    expect(jobStep(card({ fit: 60 }), { ...ready, briefConfirmed: false })).toBe('shortlist');
    expect(jobStep(card(), ready)).toBe('evaluate-fit');
    expect(jobStep(card({ fit: 0 }), ready)).toBe('shortlist');
    expect(jobStep(card({ fit: 72 }), ready)).toBe('shortlist');
    // Leads are not gated on the employer form: that check belongs to drafting.
    expect(jobStep(card({ fit: 72 }), { ...ready, formMissing: true })).toBe('shortlist');
  });

  it('orders the form, brief and answer gates before drafting', () => {
    const shortlisted = card({ state: 'shortlisted' });
    expect(jobStep(shortlisted, { ...ready, formMissing: true, hasBrief: false })).toBe(
      'check-form',
    );
    expect(jobStep(shortlisted, { ...ready, hasBrief: false })).toBe('prepare-brief');
    expect(jobStep(shortlisted, { ...ready, briefConfirmed: false })).toBe('confirm-brief');
    expect(jobStep(shortlisted, { ...ready, missingAnswers: true })).toBe('answer-requirements');
    expect(jobStep(shortlisted, ready)).toBe('draft');
    expect(jobStep(card({ state: 'changes_requested', packet: {} as Card['packet'] }), ready)).toBe(
      'revise',
    );
    // A failed first draft saves no packet: the next move drafts it, never "revises" nothing.
    expect(jobStep(card({ state: 'changes_requested' }), ready)).toBe('draft');
  });

  it('names review before approval and only offers recording after export', () => {
    const packet = {} as Card['packet'];
    const reviewed = {
      packet,
      applicationContext: context(),
      packetReview: { contextRevision: 'r1' },
    };
    expect(jobStep(card({ state: 'in_review', packet }), ready)).toBe('review');
    // A packet whose review no longer matches the brief needs a fresh review before export.
    expect(jobStep(card({ state: 'agreed', packet, applicationContext: context() }), ready)).toBe(
      'review',
    );
    expect(jobStep(card({ state: 'agreed', ...reviewed } as Partial<Card>), ready)).toBe('export');
    const awaiting = card({ state: 'awaiting_approval', ...reviewed } as Partial<Card>);
    expect(jobStep(awaiting, ready)).toBe('approve');
    expect(jobStep(awaiting, { ...ready, exported: true })).toBe('apply');
    for (const state of ['submitted', 'interviewing', 'offer', 'rejected'] as const)
      expect(jobStep(card({ state }), ready)).toBe('outcome');
  });

  it('derives snapshot facts from the confirmed revision, form choice and answers', () => {
    expect(snapshotStepFacts(card(), [])).toMatchObject({ hasBrief: false, briefConfirmed: false });
    const confirmed = context({ confirmedAt: 'now', confirmedRevision: 'r1' });
    expect(snapshotStepFacts(card({ applicationContext: confirmed }), [])).toMatchObject({
      hasBrief: true,
      briefConfirmed: true,
      formMissing: false,
    });
    expect(
      snapshotStepFacts(card({ applicationContext: { ...confirmed!, revision: 'r2' } }), []),
    ).toMatchObject({ briefConfirmed: false });
    const linked = card({ url: 'https://example.com/apply', applicationContext: confirmed });
    expect(snapshotStepFacts(linked, [])).toMatchObject({
      formMissing: true,
      briefConfirmed: false,
    });
    const manual = { ...confirmed!, form: { status: 'manual' } } as Card['applicationContext'];
    expect(snapshotStepFacts({ ...linked, applicationContext: manual }, [])).toMatchObject({
      formMissing: false,
      briefConfirmed: true,
    });
    // A later inspection replaces the confirmed manual choice and needs confirming again.
    expect(
      snapshotStepFacts(
        { ...linked, applicationContext: manual, formAssessments: [{}] as Card['formAssessments'] },
        [],
      ),
    ).toMatchObject({ formMissing: false, briefConfirmed: false });
    const unanswered = context({
      requirements: [{ id: 'why', question: 'Why?', required: true, personal: true, answer: ' ' }],
    });
    expect(snapshotStepFacts(card({ applicationContext: unanswered }), [])).toMatchObject({
      missingAnswers: true,
    });
  });

  it('treats only changed inspected requirements as needing confirmation again', () => {
    type Field = NonNullable<Card['formAssessments']>[number]['fields'][number];
    const baseline = {
      label: 'Why us?',
      type: 'textarea',
      required: true,
      visible: true,
      disabled: false,
      accept: '',
      options: ['Remote', 'Hybrid'],
      maxLength: 500,
      optionsTotal: 2,
      optionsTruncated: false,
      buttonType: 'button',
      group: { role: 'group', label: 'Application', required: true },
      constraints: {
        minLength: { status: 'declared', value: '20' },
        maxLength: { status: 'absent' },
        min: { status: 'absent' },
        max: { status: 'absent' },
        step: { status: 'absent' },
        uploadSizeLimit: 'unknown',
      },
      assessed: true,
      condition: '',
      missingAnswer: 'Why us?',
      // Browser-only details never reach the brief and must not count as changes.
      selector: '#why',
    } satisfies Field;
    const control = (overrides: Partial<Field> = {}): Field => ({ ...baseline, ...overrides });
    type Assessment = NonNullable<Card['formAssessments']>[number];
    const assessment = (fields: Field[], blockers: string[] = []): Assessment => ({
      ...formAssessment('job'),
      fields,
      blockers,
      uninspected: [],
    });
    const adopted = inspectedApplicationForm({ formAssessments: [assessment([baseline])] });
    const linked = (assessments: Assessment[], form = adopted) =>
      card({
        state: 'shortlisted',
        url: 'https://example.com/apply',
        formAssessments: assessments,
        applicationContext: context({
          confirmedAt: 'now',
          confirmedRevision: 'r1',
          form,
        }),
      });
    const facts = (job: Card) => {
      const snapshot = snapshotStepFacts(job, []);
      expect(snapshot.briefConfirmed).toBe(applicationFormIsCurrent(job));
      return snapshot;
    };
    const current = (job: Card) => facts(job).briefConfirmed;
    expect(current(linked([assessment([control()])]))).toBe(true);
    // A newer identical inspection stays current.
    expect(
      current(linked([assessment([control()]), assessment([control({ selector: '#x' })])])),
    ).toBe(true);
    // Resolving an answer is progress, not a changed requirement.
    expect(current(linked([assessment([control({ missingAnswer: '' })])]))).toBe(true);
    expect(
      current(
        linked([
          assessment([
            control({
              group: { required: true, label: 'Application', role: 'group' },
              constraints: {
                ...baseline.constraints,
                minLength: { value: '20', status: 'declared' },
              },
            }),
          ]),
        ]),
      ),
    ).toBe(true);
    // Changed requirements need confirming again and send a shortlisted job back to the brief.
    for (const changed of [
      [control({ optionsTotal: 3 })],
      [control({ options: ['Hybrid', 'Remote'] })],
      [control({ optionsTruncated: true })],
      [control({ group: { ...baseline.group, required: false } })],
      [control({ constraints: { ...baseline.constraints, minLength: { status: 'absent' } } })],
      [control({ maxLength: 300 })],
      [control({ required: false })],
      [control({ buttonType: 'submit' })],
      [control({ optionsTotal: 101, optionsTruncated: true })],
      [control({ group: { role: 'fieldset', label: 'Work authorization', required: true } })],
      [
        control({
          constraints: {
            minLength: { status: 'absent' },
            maxLength: { status: 'absent' },
            min: { status: 'declared', value: '18' },
            max: { status: 'absent' },
            step: { status: 'absent' },
            uploadSizeLimit: 'unknown',
          },
        }),
      ],
      [control({ label: 'Why this team?' })],
      [control(), control({ label: 'Portfolio' })],
    ]) {
      const job = linked([assessment([control()]), assessment(changed)]);
      const snapshot = facts(job);
      expect(snapshot.briefConfirmed).toBe(false);
      expect(jobStep(job, snapshot)).toBe('confirm-brief');
    }
    expect(current(linked([assessment([control()], ['Sign-in required'])]))).toBe(false);
    const historical = assessment([control({ optionsTruncated: undefined })]);
    const historicalForm = inspectedApplicationForm({ formAssessments: [historical] });
    expect(current(linked([historical], historicalForm))).toBe(true);
    expect(current(linked([assessment([baseline])], historicalForm))).toBe(false);
    // An adopted inspection with no assessment behind it is not current.
    expect(current(linked([]))).toBe(false);
  });

  it('counts only a consumed export of the current packet', () => {
    const packet = { resume: 'a' } as unknown as Card['packet'];
    const job = card({ packet });
    const approval = (fields: Partial<Approval>) =>
      ({ cardId: 'job', status: 'consumed', exportDirectory: '/x', packet, ...fields }) as Approval;
    expect(snapshotStepFacts(job, [approval({})]).exported).toBe(true);
    expect(snapshotStepFacts(job, [approval({ status: 'pending' })]).exported).toBe(false);
    expect(snapshotStepFacts(job, [approval({ exportDirectory: undefined })]).exported).toBe(false);
    expect(
      snapshotStepFacts(job, [
        approval({ packet: { resume: 'b' } as unknown as Approval['packet'] }),
      ]).exported,
    ).toBe(false);
  });
});
