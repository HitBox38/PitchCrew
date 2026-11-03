import type { Card, Conversation } from '@pitchcrew/core';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupSkillReaders, skillReaderFixture } from './helpers/skill-reader.ts';

afterEach(cleanupSkillReaders);

describe('run-scoped skill instructions', () => {
  it('returns full frozen instructions after edits, reassignment and deletion without recording read events', async () => {
    const { service, run, skill, input, read, access, request } = await skillReaderFixture(35372);
    expect(await access()).toMatchObject({ readSkills: true });
    const original = await read();
    expect(original).toMatchObject({ skill: { id: skill.id, content: input.content } });
    expect(JSON.stringify(original)).not.toContain('OTHER-ROLE-PRIVATE-INSTRUCTIONS');
    service.saveSkill(
      { ...input, name: 'Edited method', content: 'NEW-SKILL-TEXT', roleIds: ['reviewer'] },
      skill.id,
    );
    service.deleteSkill(skill.id);
    const before = service.board.history(run.id);
    const { response, result } = await request(
      '/agent',
      'POST',
      {
        action: 'read_skill',
        input: { skillId: skill.id },
      },
      { authorization: `Bearer ${run.id}` },
    );
    expect(response.status).toBe(200);
    expect(result).toEqual(original);
    expect(await read()).toEqual(original);
    expect(service.board.history(run.id)).toEqual(before);
  });

  it('rejects other-role, unknown and non-ID inputs without exposing their contents', async () => {
    const { service, run, other, read, access, skill } = await skillReaderFixture(35372);
    await expect(read(other.id)).rejects.toThrow('not assigned to this run');
    await expect(read('00000000-0000-4000-8000-000000000000')).rejects.toThrow('not assigned');
    await expect(read('../skills/private/SKILL.md')).rejects.toThrow();
    await expect(
      service.agentCall(run.id, 'read_skill', {
        input: { skillId: skill.id, roleId: 'reviewer' },
      }),
    ).rejects.toThrow();
    // A capability cannot borrow a snapshot saved for a different role.
    service.capabilities.set(run.id, { runId: run.id, roleId: 'reviewer', cardId: null });
    expect(await access()).toMatchObject({ readSkills: false });
    await expect(read()).rejects.toThrow();
  });

  it.each(['fit', 'application-draft', 'application-review', 'packet-evaluation'] as const)(
    'allows own frozen guidance in isolated %s runs without source access',
    async (purpose) => {
      const { service, run, isolated, read, access, skill, updateRun } =
        await skillReaderFixture(35372);
      const isolatedRun = isolated(purpose);
      expect(await access()).toMatchObject({ readSkills: true });
      expect(await read()).toMatchObject({ skill: { id: skill.id } });
      expect(JSON.stringify(await read())).not.toContain('RAW-POSTING-INSTRUCTIONS');
      await expect(service.agentCall(run.id, 'history', {})).rejects.toThrow('isolated');
      updateRun({ reviewSubagentId: 'targeted-child', deepReviewId: 'review-parent' });
      expect(await read()).toMatchObject({ skill: { id: skill.id } });
      await expect(service.agentCall(run.id, 'ask_user', {})).rejects.toThrow('parent');
      const card = service.board.get<Card>('card', isolatedRun.cardId!);
      service.board.record(
        'card',
        {
          ...card,
          applicationContext: { ...card.applicationContext!, revision: 'different-context' },
        },
        'user',
        'Changed context fixture',
      );
      expect(await access()).toMatchObject({ readSkills: false });
      await expect(read()).rejects.toThrow('context changed');
    },
  );

  it.each([
    'source',
    'budget',
    'summary',
    'question',
    'completed',
    'snapshot',
    'controller',
  ] as const)('denies skill reading for %s turns in discovery and execution', async (reason) => {
    const { service, run, updateRun, isolated, summary, access, read } =
      await skillReaderFixture(35372);
    if (reason === 'source') updateRun({ purpose: 'source-extraction' });
    if (reason === 'budget') {
      isolated('application-review');
      updateRun({ deepReviewId: 'review', reviewBudgetRequest: true });
    }
    if (reason === 'summary') summary();
    if (reason === 'question')
      await service.agentCall(run.id, 'ask_user', {
        question: 'Which example?',
        continuationNotes: 'Waiting for example.',
      });
    if (reason === 'completed') updateRun({ status: 'completed' });
    if (reason === 'snapshot') updateRun({ configuration: undefined });
    if (reason === 'controller') service.controllers.delete(run.id);
    if (reason === 'completed') await expect(access()).rejects.toThrow('expired');
    else expect(await access()).toMatchObject({ readSkills: false });
    await expect(read()).rejects.toThrow();
  });

  it('rechecks revocation and never adds reader access to the external bridge', async () => {
    const { service, run, role, access, read, skill } = await skillReaderFixture(35372);
    const conversation = service.board.get<Conversation>('conversation', role.id);
    service.board.record(
      'conversation',
      { ...conversation, participants: ['scout'] },
      'user',
      'Remove reader from conversation',
    );
    expect(await access()).toMatchObject({ readSkills: false });
    await expect(read()).rejects.toThrow('Conversation access');
    service.board.record('conversation', conversation, 'user', 'Restore fixture conversation');
    service.board.record('role', { ...role, enabled: false }, 'user', 'Pause reader');
    await expect(read()).rejects.toThrow('paused');
    service.board.record('role', role, 'user', 'Restore reader');
    service.controllers.get(run.id)!.abort();
    await expect(read()).rejects.toThrow('expired');
    await expect(service.externalCall('read_skill', { skillId: skill.id })).rejects.toThrow(
      'external MCP action',
    );
  });
});
