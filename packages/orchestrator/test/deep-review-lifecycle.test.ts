import { adapters } from '@pitchcrew/adapters';
import { saveApplicationContext } from '@pitchcrew/board';
import type {
  Card,
  DeepReview,
  ReviewSubagent,
  Run,
  RunContext,
  UserInputRequest,
} from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, finish, waitForSnapshot } from './helpers/daemon.ts';
import { assessment, deepReviewFixture } from './helpers/deep-reviews.ts';
afterEach(cleanup);
const passing = () => ({
  role: 'reviewer' as const,
  passed: true,
  feedback: [],
  assessment: assessment(),
});
it('reports a failed optional child while completing the parent, and denies child delegation', async () => {
  const { daemon, request, card } = await deepReviewFixture(24511);
  const original = adapters.demo.run.bind(adapters.demo);
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer') return original(context);
    const token = context.mcp.env.PITCHCREW_RUN_TOKEN!;
    if (context.deepReview?.subagent) {
      await expect(
        daemon.service.agentCall(token, 'start_review_subagent', {
          perspective: 'ceo',
          focus: 'Inspect supported impact evidence.',
          reason: 'Need another opinion about impact.',
        }),
      ).rejects.toThrow('Only the parent');
      await expect(
        daemon.service.agentCall(token, 'ask_user', {
          input: { question: 'Should I invent a metric?' },
        }),
      ).rejects.toThrow('only the parent asks');
      throw new Error('Fictional optional runtime failure.');
    }
    if (context.deepReview?.stage === 'review') {
      await daemon.service.agentCall(token, 'start_review_subagent', {
        perspective: 'impact',
        focus: 'Inspect the supported impact evidence.',
        reason: 'An independent targeted opinion would help.',
      });
      await daemon.service.agentCall(token, 'review_subagents', { waitMs: 1000 });
    }
    return passing();
  });
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  await finish(request, run.id);
  expect(daemon.service.board.list<DeepReview>('deep_review')[0]!.summary).toContain('incomplete');
  expect(daemon.service.board.list<ReviewSubagent>('review_subagent')[0]!.status).toBe('failed');
});
it('routes a Writer time request through a separate parent decision without giving Writer extension authority', async () => {
  const { daemon, request, card } = await deepReviewFixture(24512);
  const original = adapters.demo.run.bind(adapters.demo);
  let decisions = 0;
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    const token = context.mcp.env.PITCHCREW_RUN_TOKEN!;
    if (context.deepReview?.budgetRequest) {
      decisions++;
      await daemon.service.agentCall(
        token,
        'extend_review_deadline',
        context.deepReview.budgetRequest,
      );
      return { role: 'reviewer', passed: true, feedback: [] };
    }
    if (context.role.workflow === 'writer') {
      await expect(
        daemon.service.agentCall(token, 'extend_review_deadline', {
          minutes: 10,
          reason: 'Need time to complete the verified draft.',
        }),
      ).rejects.toThrow('Only the parent');
      await daemon.service.agentCall(token, 'request_review_time', {
        minutes: 10,
        reason: 'Need time to complete the verified draft.',
      });
      return original(context);
    }
    return passing();
  });
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  await finish(request, run.id);
  expect(decisions).toBe(1);
  expect(daemon.service.board.list<DeepReview>('deep_review')[0]!.extensions[0]!.minutes).toBe(10);
});
it('cancels the parent and all running subagents together', async () => {
  const { daemon, request, card } = await deepReviewFixture(24513);
  const original = adapters.demo.run.bind(adapters.demo);
  const aborted: string[] = [];
  const started: string[] = [];
  const wait = (context: RunContext) => {
    started.push(context.deepReview?.subagent ? 'child' : 'parent');
    return new Promise<never>((_, reject) =>
      context.signal.addEventListener(
        'abort',
        () => {
          aborted.push(context.deepReview?.subagent ? 'child' : 'parent');
          reject(new Error('Cancelled fixture.'));
        },
        { once: true },
      ),
    );
  };
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer') return original(context);
    if (!context.deepReview?.subagent)
      await daemon.service.agentCall(
        context.mcp.env.PITCHCREW_RUN_TOKEN!,
        'start_review_subagent',
        {
          perspective: 'impact',
          focus: 'Inspect the supported impact evidence.',
          reason: 'Need a targeted second opinion about impact.',
        },
      );
    return wait(context);
  });
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  await vi.waitFor(() => expect(started.sort()).toEqual(['child', 'parent']), { timeout: 10000 });
  await request(`/runs/${run.id}/cancel`, 'POST', {});
  await waitForSnapshot(
    request,
    (snapshot) => snapshot.runs.find((r) => r.id === run.id)?.status === 'cancelled',
  );
  expect(aborted.sort()).toEqual(['child', 'parent']);
  expect(daemon.service.controllers.size).toBe(0);
  expect(daemon.service.capabilities.size).toBe(0);
  expect(daemon.service.board.get<Card>('card', card.id).owner).toBeNull();
});
it('waits for missing information and resumes the same report using only review-scoped user clarifications', async () => {
  const { daemon, request, card } = await deepReviewFixture(24514);
  const original = adapters.demo.run.bind(adapters.demo);
  let asked = false;
  let sawAnswer = false;
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer' && !asked) {
      asked = true;
      await daemon.service.agentCall(context.mcp.env.PITCHCREW_RUN_TOKEN!, 'ask_user', {
        input: {
          question: 'Which supported experience should the draft emphasize?',
          continuationNotes: 'Wait for the requested emphasis.',
        },
      });
      throw new Error('Question ends the fixture turn.');
    }
    if (context.role.workflow === 'writer') {
      sawAnswer =
        context.deepReview?.clarifications?.some(
          (answer) => answer.answer === 'React interfaces',
        ) ?? false;
      return original(context);
    }
    return passing();
  });
  await request(`/cards/${card.id}/deep-reviews`, 'POST', {});
  const waiting = await waitForSnapshot(
    request,
    (snapshot) =>
      snapshot.userInputs?.some((q) => q.status === 'pending') === true &&
      snapshot.runs.some((r) => r.purpose === 'deep-review' && r.status === 'waiting'),
  );
  const question = waiting.userInputs!.find((q) => q.status === 'pending')!;
  const reviewId = daemon.service.board.list<DeepReview>('deep_review')[0]!.id;
  const answer = await request(`/user-input/${question.id}/answer`, 'POST', {
    text: 'React interfaces',
  });
  expect(answer.response.status).toBe(202);
  await waitForSnapshot(
    request,
    () => daemon.service.board.list<DeepReview>('deep_review')[0]?.status === 'completed',
  );
  expect(sawAnswer).toBe(true);
  expect(daemon.service.board.list<DeepReview>('deep_review').map((r) => r.id)).toEqual([reviewId]);
  expect(daemon.service.board.get<UserInputRequest>('user_input', question.id).status).toBe(
    'answered',
  );
});
it('rejects changed Profile evidence instead of applying a stale review', async () => {
  const { daemon, directory, request, card } = await deepReviewFixture(24515);
  const original = adapters.demo.run.bind(adapters.demo);
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer') return original(context);
    await writeFile(
      join(directory, 'profile', 'profile.md'),
      '# Fictional Candidate\n- Built a different interface.',
    );
    return passing();
  });
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  await waitForSnapshot(
    request,
    (snapshot) => snapshot.runs.find((r) => r.id === run.id)?.status === 'failed',
  );
  expect(daemon.service.board.list<DeepReview>('deep_review')[0]!.error).toContain(
    'Profile evidence changed',
  );
  expect(daemon.service.board.get<Card>('card', card.id).packetReview).toBeUndefined();
});
it('continues without subagents when the runtime does not advertise support', async () => {
  const { daemon, request, card } = await deepReviewFixture(24516);
  const original = adapters.demo.run.bind(adapters.demo);
  const support = adapters.demo.reviewSubagents;
  adapters.demo.reviewSubagents = undefined;
  try {
    vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
      if (context.role.workflow === 'writer') return original(context);
      if (context.deepReview?.stage === 'review')
        expect(
          await daemon.service.agentCall(
            context.mcp.env.PITCHCREW_RUN_TOKEN!,
            'start_review_subagent',
            {
              perspective: 'impact',
              focus: 'Inspect the supported impact evidence.',
              reason: 'A targeted opinion would be useful.',
            },
          ),
        ).toMatchObject({ status: 'unavailable' });
      return passing();
    });
    const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
    await finish(request, run.id);
    expect(daemon.service.board.list<ReviewSubagent>('review_subagent')[0]?.status).toBe(
      'unavailable',
    );
  } finally {
    adapters.demo.reviewSubagents = support;
  }
});
it('cancels a waiting review and its question when the job is deleted', async () => {
  const { daemon, request, card } = await deepReviewFixture(24517);
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    await daemon.service.agentCall(context.mcp.env.PITCHCREW_RUN_TOKEN!, 'ask_user', {
      input: { question: 'Which supported experience should be emphasized?' },
    });
    throw new Error('Wait for user information.');
  });
  await request(`/cards/${card.id}/deep-reviews`, 'POST', {});
  await waitForSnapshot(
    request,
    () =>
      daemon.service.board.list<DeepReview>('deep_review')[0]?.status === 'waiting' &&
      daemon.service.controllers.size === 0,
  );
  expect((await request(`/cards/${card.id}`, 'DELETE')).response.status).toBe(200);
  expect(daemon.service.board.list<DeepReview>('deep_review')[0]?.status).toBe('cancelled');
  expect(daemon.service.board.list<UserInputRequest>('user_input')[0]?.status).toBe('cancelled');
});
it('reserves Writer across review stages and releases both seats when the task finishes', async () => {
  const { daemon, request, card } = await deepReviewFixture(24518);
  const original = adapters.demo.run.bind(adapters.demo);
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer') return original(context);
    await expect(
      daemon.service.configureRole('writer', {
        ...daemon.service.board.get<import('@pitchcrew/core').Role>('role', 'writer'),
        model: 'changed-mid-review',
      }),
    ).rejects.toThrow();
    return passing();
  });
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  await finish(request, run.id);
  expect(
    daemon.service.board
      .list<Run>('run')
      .some((r) => r.reviewSeatReservation && r.status === 'running'),
  ).toBe(false);
  expect(daemon.service.controllers.size).toBe(0);
});
it('resumes a final recheck without replacing the original before assessment or repeating completed corrections', async () => {
  const { daemon, request, card } = await deepReviewFixture(24519);
  const original = adapters.demo.run.bind(adapters.demo);
  const stages: string[] = [];
  let asked = false;
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    stages.push(context.deepReview!.stage);
    if (context.role.workflow === 'writer') {
      const result = await original(context);
      if (result.role === 'writer' && context.deepReview?.stage === 'correction')
        result.packet.resume = result.packet.resume.replace(
          '## Application for Engineer',
          '## Relevant experience',
        );
      return result;
    }
    if (context.deepReview?.stage === 'review') {
      const result = passing();
      result.assessment.findings.push({
        severity: 'advisory',
        quote: 'Built a React interface.',
        reason: 'Consider a concise section heading.',
        correction: 'Use Relevant experience for the heading.',
        perspectives: ['recruiter'],
      });
      return result;
    }
    if (!asked) {
      asked = true;
      await daemon.service.agentCall(context.mcp.env.PITCHCREW_RUN_TOKEN!, 'ask_user', {
        input: { question: 'Keep the concise section heading?' },
      });
      throw new Error('Wait for the answer.');
    }
    return passing();
  });
  await request(`/cards/${card.id}/deep-reviews`, 'POST', {});
  const waiting = await waitForSnapshot(
    request,
    () =>
      daemon.service.board.list<DeepReview>('deep_review')[0]?.status === 'waiting' &&
      daemon.service.controllers.size === 0,
  );
  const question = waiting.userInputs!.find((q) => q.status === 'pending')!;
  await request(`/user-input/${question.id}/answer`, 'POST', { text: 'Keep it concise.' });
  await waitForSnapshot(
    request,
    () => daemon.service.board.list<DeepReview>('deep_review')[0]?.status === 'completed',
  );
  const report = daemon.service.board.list<DeepReview>('deep_review')[0]!;
  expect(stages).toEqual(['draft', 'review', 'correction', 'recheck', 'recheck']);
  expect(report.originalResume).toContain('Application for Engineer');
  expect(report.finalResume).toContain('Relevant experience');
  expect(report.before?.findings).toHaveLength(1);
});

it('corrects the packet after a required personal answer changes the confirmed context during recheck', async () => {
  const { daemon, request, card } = await deepReviewFixture(24520);
  const application = daemon.service.board.get<Card>('card', card.id).applicationContext!;
  saveApplicationContext(
    daemon.service.board,
    card.id,
    application.sourceRevision,
    application.revision,
    {
      brief: application.brief,
      flagged: [],
      requirements: [
        {
          id: 'availability',
          question: 'When can you start?',
          required: true,
          personal: true,
          answer: '',
        },
      ],
    },
    true,
  );
  const original = adapters.demo.run.bind(adapters.demo);
  const stages: string[] = [];
  let asked = false;
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    stages.push(context.deepReview!.stage);
    if (context.role.workflow === 'writer') {
      const result = await original(context);
      if (result.role === 'writer' && context.card.applicationContext?.requirements[0]?.answer)
        result.packet.formAnswers = context.card.applicationContext.requirements[0].answer;
      return result;
    }
    if (context.deepReview?.stage === 'recheck' && !asked) {
      asked = true;
      await daemon.service.agentCall(context.mcp.env.PITCHCREW_RUN_TOKEN!, 'ask_user', {
        input: { question: 'When can you start?', applicationRequirementId: 'availability' },
      });
      throw new Error('Wait for the required answer.');
    }
    return passing();
  });
  await request(`/cards/${card.id}/deep-reviews`, 'POST', {});
  const waiting = await waitForSnapshot(
    request,
    () =>
      daemon.service.board.list<DeepReview>('deep_review')[0]?.status === 'waiting' &&
      daemon.service.controllers.size === 0,
  );
  const before = daemon.service.board.list<DeepReview>('deep_review')[0]!.before;
  const question = waiting.userInputs!.find((q) => q.status === 'pending')!;
  const answered = await request(`/user-input/${question.id}/answer`, 'POST', {
    text: 'In four weeks.',
  });
  expect(answered.response.status).toBe(202);
  await waitForSnapshot(
    request,
    () => daemon.service.board.list<DeepReview>('deep_review')[0]?.status === 'completed',
  );
  const report = daemon.service.board.list<DeepReview>('deep_review')[0]!;
  const finalCard = daemon.service.board.get<Card>('card', card.id);
  expect(stages).toEqual(['draft', 'review', 'recheck', 'correction', 'recheck']);
  expect(report.before).toEqual(before);
  expect(report.beforeContextRevision).not.toBe(report.contextRevision);
  expect(finalCard.packet?.formAnswers).toBe('In four weeks.');
  expect(finalCard.packetContextRevision).toBe(report.contextRevision);
  expect(finalCard.packetReview?.contextRevision).toBe(report.contextRevision);
});
