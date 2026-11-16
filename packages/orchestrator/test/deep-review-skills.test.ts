import { adapters } from '@pitchcrew/adapters';
import { promptFor } from '../../adapters/src/process.ts';
import type { DeepReview, ReviewSubagent, Run } from '@pitchcrew/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, finish } from './helpers/daemon.ts';
import { assessment, deepReviewFixture } from './helpers/deep-reviews.ts';
import { reviewSummary } from './helpers/review-summary.ts';

afterEach(cleanup);

it('reads IDs supplied to real isolated review stages and children without exposing unassigned skills', async () => {
  const { daemon, request, card } = await deepReviewFixture();
  const service = daemon.service;
  const input = {
    name: 'Evidence review method',
    description: 'Use when reviewing candidate evidence.',
    content: 'Keep every claim supported by exact verified evidence.',
    scope: 'roles' as const,
    roleIds: ['writer', 'reviewer'],
  };
  const included = service.saveSkill(input);
  const deferred = service.saveSkill({
    ...input,
    name: 'Optional review method',
    content: 'Check the supported scope of every achievement.',
    includeInEveryRun: false,
  });
  const unassigned = service.saveSkill({
    ...input,
    name: 'Scout private method',
    content: 'PRIVATE-SCOUT-GUIDANCE',
    roleIds: ['scout'],
  });
  const original = adapters.demo.run.bind(adapters.demo);
  const stages: string[] = [];
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    const prompt = promptFor(context);
    const instructions = await readFile(join(context.directory, 'AGENTS.md'), 'utf8');
    const id = /Skill ID \(skillId\): ([\da-f-]{36})/.exec(prompt)?.[1];
    expect(id).toBe(included.id);
    expect(instructions).toContain(`Skill ID (skillId): ${id}`);
    expect(prompt).toContain(
      JSON.stringify({
        id: deferred.id,
        name: deferred.name,
        description: deferred.description,
      }),
    );
    expect(prompt).not.toContain(unassigned.id);
    expect(prompt).not.toContain(unassigned.content);
    const token = context.mcp.env.PITCHCREW_RUN_TOKEN!;
    for (const skill of [included, deferred])
      expect(
        await service.agentCall(token, 'read_skill', {
          input: { skillId: skill.id === included.id ? id : skill.id },
        }),
      ).toMatchObject({ skill: { id: skill.id, content: skill.content } });
    await expect(
      service.agentCall(token, 'read_skill', { input: { skillId: unassigned.id } }),
    ).rejects.toThrow('not assigned');
    stages.push(context.deepReview?.subagent ? 'child' : context.deepReview!.stage);
    if (context.role.workflow === 'writer') return original(context);
    const result = assessment();
    if (context.deepReview?.subagent)
      result.perspectives = [
        { ...result.perspectives[0]!, perspective: context.deepReview.subagent.perspective },
      ];
    return {
      role: 'reviewer',
      passed: true,
      feedback: [],
      summary: reviewSummary(),
      assessment: result,
    };
  });
  const run = (
    await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {
      secondOpinions: true,
      requestedPerspectives: ['impact'],
    })
  ).result;
  const snapshot = await finish(request, run.id);
  expect(snapshot.cards.find((item) => item.id === card.id)?.state).toBe('agreed');
  expect(stages).toEqual(expect.arrayContaining(['draft', 'child', 'review', 'recheck']));
  expect(service.board.list<DeepReview>('deep_review')[0]!.status).toBe('completed');
  expect(service.board.list<ReviewSubagent>('review_subagent')).toEqual([
    expect.objectContaining({ status: 'completed' }),
  ]);
  expect(snapshot.approvals).toHaveLength(0);
});
