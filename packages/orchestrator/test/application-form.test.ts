import { adapters } from '@pitchcrew/adapters';
import {
  cardInput,
  type Card,
  type ExtractedJob,
  type Role,
  type Run,
  type Snapshot,
} from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, finish, setup, waitForSnapshot } from './helpers/daemon.ts';
import { formAssessment } from '../../board/test/fixtures/form.ts';

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
  const { daemon, request } = await setup(24308, false, { browserLaunch: async () => driver });
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
    requirements: [],
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
    await daemon.service.agentCall(token, 'computer_inspect', {});
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
  await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.some(
      (run) => run.threadId === inspection.result.threadId && run.status === 'completed',
    ),
  );
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
      await daemon.service.agentCall(token, 'ask_user', { input: { question: 'Why this team?' } });
      throw new Error('End question turn');
    }
    expect(context.userAnswers).toEqual([
      expect.objectContaining({
        question: 'Why this team?',
        answer: 'I enjoy building interfaces with a small team.',
      }),
    ]);
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
      : { role: 'reviewer', passed: true, feedback: [] };
  });
  for (const roleId of ['writer', 'reviewer']) {
    const run = (await request<Run>(`/cards/${card.id}/run`, 'POST', { roleId })).result;
    if (roleId === 'writer') {
      const waiting = await waitForSnapshot(request, (snapshot) =>
        snapshot.runs.some((entry) => entry.id === run.id && entry.status === 'waiting'),
      );
      const question = waiting.userInputs!.find((entry) => entry.runId === run.id)!;
      expect(question.applicationContextRevision).toBe(
        daemon.service.board.get<Card>('card', card.id).applicationContext?.revision,
      );
      expect(
        (
          await request(`/user-input/${question.id}/answer`, 'POST', {
            text: 'I enjoy building interfaces with a small team.',
          })
        ).response.status,
      ).toBe(202);
      await waitForSnapshot(request, (snapshot) =>
        snapshot.runs.some(
          (entry) => entry.purpose === 'application-draft' && entry.status === 'completed',
        ),
      );
    } else await finish(request, run.id);
    await vi.waitFor(() => expect(daemon.service.controllers.size).toBe(0));
  }
  expect(daemon.service.board.get<Card>('card', card.id).state).toBe('agreed');
  expect(chat).toHaveBeenCalledTimes(2);
  expect(driver.perform).not.toHaveBeenCalled();
});

it('does not grant browser/form permissions or start inspection for missing links and uncertain outcomes', async () => {
  const { daemon, request } = await setup(24309);
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
