import { adapters } from '@pitchcrew/adapters';
import {
  cardInput,
  type Card,
  type ComputerApproval,
  type ExtractedJob,
  type Role,
  type Run,
  type Snapshot,
} from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, finish, setup, waitForSnapshot } from './helpers/daemon.ts';
import { formAssessment } from '../../board/test/fixtures/form.ts';
import { reviewSummary } from './helpers/review-summary.ts';

afterEach(cleanup);
it('inspects before drafting and carries confirmed fields through isolated extraction, Writer and Reviewer tools', async () => {
  const fields = formAssessment('fixture').fields;
  const driver = {
    snapshot: vi.fn(async () => ({
      ...formAssessment('fixture').page,
      screenshot: '',
      controls: fields,
    })),
    perform: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  const { daemon, request } = await setup(false, { browserLaunch: async () => driver });
  await daemon.service.saveProfile('profile.md', 'Built a React interface.');
  const card = daemon.service.board.createCard(
    cardInput.parse({
      company: 'Fictional',
      title: 'Engineer',
      url: 'https://example.com/apply',
    }),
  );
  daemon.service.board.move(card.id, 'shortlisted', 'user');
  const brief: ExtractedJob = {
    brief: {
      companyContext: '',
      responsibilities: ['Build interfaces'],
      qualifications: [],
      constraints: [],
    },
    requirements: [
      {
        id: 'availability',
        question: 'When could you start?',
        required: true,
        personal: true,
        answer: '',
      },
    ],
    flagged: [],
  };
  const initial = (
    await request<{ sourceRevision: string }>(`/cards/${card.id}/application-context`)
  ).result;
  const blocked = await request(`/cards/${card.id}/application-context/confirm`, 'POST', {
    sourceRevision: initial.sourceRevision,
    expectedRevision: null,
    context: brief,
  });
  expect(blocked.response.status).toBe(400);
  expect(
    (await request(`/cards/${card.id}/draft`, 'POST', { roleId: 'writer' })).response.status,
  ).toBe(400);
  const chat = vi.spyOn(adapters.demo, 'chat').mockImplementation(async (context) => {
    const token = context.mcp.env.PITCHCREW_RUN_TOKEN!;
    if (context.purpose === 'source-extraction') {
      expect(context.sourceText).toContain('.pdf,.docx');
      expect(context.sourceText).not.toMatch(
        /RAW-BROWSER-TEXT|entered-value@example.com|#motivation/,
      );
      expect(context.profile).toEqual([]);
      return { reply: JSON.stringify(brief) };
    }
    expect(context.messages.at(-1)?.content).toContain('BEFORE packet drafting');
    expect(context.messages.at(-1)?.content).toContain(
      'it returns at once when your browser mode approves the action',
    );
    await daemon.service.agentCall(token, 'computer_inspect', {});
    const { approval } = (await daemon.service.agentCall(token, 'computer_request', {
      input: { kind: 'navigate', url: card.url },
      reason: 'Inspect the application before drafting',
    })) as { approval: ComputerApproval };
    const run = daemon.service.board.get<Run>('run', approval.runId);
    expect(run).toMatchObject({ mode: 'chat', roleId: 'submitter', cardId: card.id });
    expect(approval).toMatchObject({
      roleId: 'submitter',
      cardId: card.id,
      status: 'pending',
      error: '',
      decidedAt: null,
    });
    daemon.service.board.rebuild();
    const inbox = (await request<Snapshot>('/snapshot?view=workspace')).result;
    expect(inbox.computerApprovals).toContainEqual(approval);
    await expect(
      daemon.service.computer.execute(
        run.id,
        approval.id,
        new AbortController().signal,
        () => {},
        0,
      ),
    ).resolves.toMatchObject({ status: 'pending' });
    await expect(
      daemon.service.computer.execute(
        'different-run',
        approval.id,
        new AbortController().signal,
        () => {},
        0,
      ),
    ).rejects.toThrow('another run');
    expect(
      (await request(`/computer-approvals/${approval.id}/decide`, 'POST', { approved: true }))
        .response.status,
    ).toBe(200);
    await expect(
      daemon.service.agentCall(token, 'computer_execute', { approvalId: approval.id }),
    ).resolves.toMatchObject({ status: 'consumed' });
    expect(driver.perform).toHaveBeenCalledExactlyOnceWith(
      { kind: 'navigate', url: card.url },
      undefined,
    );
    await daemon.service.agentCall(token, 'assess_form', {
      input: {
        fields: fields.map((field) => ({ selector: field.selector })),
        uninspected: ['Questions after the first page'],
      },
    });
    return {
      reply:
        'I inspected the form. Return to the job and confirm its requirements before drafting.',
    };
  });
  const inspection = await request<{ threadId: string }>(
    `/cards/${card.id}/application-form/inspect`,
    'POST',
    { roleId: 'submitter' },
  );
  expect(inspection.response.status).toBe(200);
  const inspected = await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.some(
      (run) => run.threadId === inspection.result.threadId && run.status !== 'running',
    ),
  );
  const inspectionRun = inspected.runs.find((run) => run.threadId === inspection.result.threadId)!;
  expect(inspectionRun.status, inspectionRun.message).toBe('completed');
  const extracted = (
    await request<Run>(`/cards/${card.id}/application-context/extract`, 'POST', {
      roleId: 'writer',
    })
  ).result;
  await finish(request, extracted.id);
  await vi.waitFor(() => expect(daemon.service.controllers.size).toBe(0));
  const loaded = (
    await request<{
      sourceRevision: string;
      context: NonNullable<Card['applicationContext']>;
      form: ExtractedJob['form'];
    }>(`/cards/${card.id}/application-context`)
  ).result;
  expect(loaded.context.form).toEqual(loaded.form);
  expect(loaded.context.form).toMatchObject({
    status: 'inspected',
    fields: [{ type: 'file', required: true, accept: '.pdf,.docx' }, { maxLength: 500 }],
  });
  expect(
    (
      await request(`/cards/${card.id}/application-context/confirm`, 'POST', {
        sourceRevision: loaded.sourceRevision,
        expectedRevision: loaded.context.revision,
        context: { ...brief, form: loaded.form },
      })
    ).response.status,
  ).toBe(200);
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    expect(context.card.applicationContext?.form).toEqual(loaded.form);
    const token = context.mcp.env.PITCHCREW_RUN_TOKEN!;
    const result = await daemon.service.agentCall(token, 'card', {});
    expect(JSON.stringify(result)).toContain('.pdf,.docx');
    expect(JSON.stringify(result)).not.toMatch(
      /RAW-BROWSER-TEXT|entered-value@example.com|#resume/,
    );
    await expect(daemon.service.agentCall(token, 'computer_inspect', {})).rejects.toThrow(
      'isolated application',
    );
    if (context.role.id === 'writer' && !context.userAnswers?.length) {
      await expect(
        daemon.service.agentCall(token, 'ask_user', {
          input: { question: 'Why this team? (Required on the application form.)' },
        }),
      ).rejects.toThrow('exact unique assessed form field label');
      expect(daemon.service.board.list('user_input')).toEqual([]);
      await daemon.service.agentCall(token, 'ask_user', { input: { question: 'Why this team?' } });
      throw new Error('End question turn');
    }
    expect(context.userAnswers).toContainEqual(
      expect.objectContaining({
        question: 'Why this team?',
        answer: 'I enjoy building interfaces with a small team.',
      }),
    );
    if (!context.card.applicationContext!.requirements[0]!.answer) {
      await daemon.service.agentCall(token, 'ask_user', {
        input: { question: 'When could you start?', applicationRequirementId: 'availability' },
      });
      throw new Error('End second question turn');
    }
    expect(context.card.applicationContext!.requirements[0]!.answer).toBe('Two weeks');
    expect(context.userAnswers).toContainEqual(
      expect.objectContaining({
        question: 'When could you start?',
        answer: 'Two weeks',
      }),
    );
    expect(context.userAnswers).toHaveLength(2);
    return context.role.id === 'writer'
      ? {
          role: 'writer',
          packet: {
            resume: 'Built a React interface.',
            coverLetter: 'Built a React interface.',
            formAnswers: 'I enjoy building interfaces with a small team.',
            note: 'Later form sections remain uninspected.',
            claims: [
              {
                claim: 'Built a React interface.',
                quote: 'Built a React interface.',
                source: 'profile.md',
              },
            ],
          },
        }
      : { role: 'reviewer', passed: true, feedback: [], summary: reviewSummary() };
  });
  for (const roleId of ['writer', 'reviewer']) {
    const run = (await request<Run>(`/cards/${card.id}/run`, 'POST', { roleId })).result;
    if (roleId === 'writer') {
      for (const text of ['I enjoy building interfaces with a small team.', 'Two weeks']) {
        const waiting = await waitForSnapshot(request, (snapshot) =>
          snapshot.userInputs!.some(
            (question) =>
              question.status === 'pending' &&
              snapshot.runs.some(
                (entry) => entry.id === question.runId && entry.status === 'waiting',
              ),
          ),
        );
        const question = waiting.userInputs!.find((entry) => entry.status === 'pending')!;
        expect(question.applicationContextRevision).toBe(
          daemon.service.board.get<Card>('card', card.id).applicationContext?.revision,
        );
        if (question.applicationRequirementId) {
          const board = daemon.service.board;
          const assessments = board.get<Card>('card', card.id).formAssessments!;
          const latest = assessments.at(-1)!;
          const refreshed = {
            ...latest,
            id: 'fixture-newer-inspection',
            fields: latest.fields.map((field) => ({
              ...field,
              missingAnswer: 'New inspection note',
            })),
          };
          board.updateCard(
            card.id,
            { formAssessments: [...assessments, refreshed] },
            'submitter',
            'Updated inspection notes',
          );
        }
        expect(
          (await request(`/user-input/${question.id}/answer`, 'POST', { text })).response.status,
        ).toBe(202);
      }
      await waitForSnapshot(request, (snapshot) => {
        expect(snapshot.runs.find((entry) => entry.status === 'failed')?.message).toBeUndefined();
        return snapshot.runs.some(
          (entry) => entry.purpose === 'application-draft' && entry.status === 'completed',
        );
      });
    } else await finish(request, run.id);
    await vi.waitFor(() => expect(daemon.service.controllers.size).toBe(0));
  }
  expect(daemon.service.board.get<Card>('card', card.id).state).toBe('agreed');
  expect(daemon.service.board.list('user_input')).toHaveLength(2);
  expect(chat).toHaveBeenCalledTimes(2);
  expect(driver.perform).toHaveBeenCalledExactlyOnceWith(
    { kind: 'navigate', url: card.url },
    undefined,
  );
});

it('does not grant browser/form permissions or start inspection for missing links and uncertain outcomes', async () => {
  const { daemon, request } = await setup();
  const card = daemon.service.createCard({
    company: 'Fixture',
    title: 'Engineer',
    url: 'https://example.com/apply',
  });
  expect(
    (await request(`/cards/${card.id}/application-form/inspect`, 'POST', { roleId: 'writer' }))
      .response.status,
  ).toBe(400);
  const submitter = daemon.service.board.get<Role>('role', 'submitter');
  expect(submitter.capabilities?.assessForms).toBe(true);
  daemon.service.board.record('card', { ...card, url: '' }, 'user', 'Remove fixture link');
  expect(
    (await request(`/cards/${card.id}/application-form/inspect`, 'POST', { roleId: 'submitter' }))
      .response.status,
  ).toBe(400);
  const snapshot = (await request<Snapshot>('/snapshot')).result;
  expect(snapshot.runs).toEqual([]);
});
