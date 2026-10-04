import {
  defaultPacketRules,
  type Approval,
  type Card,
  type PacketRuleIssue,
  type PacketRules,
  type PacketRulesState,
  type Run,
  type Snapshot,
} from '@pitchcrew/core';
import { symlink, readFile, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, finish, setup } from './helpers/daemon.ts';

afterEach(cleanup);

const houseRules: PacketRules = {
  version: 1,
  rules: [
    {
      id: 'resume-body',
      kind: 'word_limit',
      severity: 'error',
      documents: ['resume'],
      max: 600,
      count: 'body',
    },
    {
      id: 'no-ai-mentions',
      kind: 'pattern',
      severity: 'error',
      documents: ['resume', 'coverLetter', 'formAnswers', 'note'],
      pattern: '\\b(?:drafted|generated) by (?:AI|an agent)\\b',
      flags: 'i',
    },
  ],
};
const warnOnGreeting = {
  id: 'greeting-style',
  kind: 'pattern',
  severity: 'warn',
  documents: ['coverLetter'],
  pattern: '^Dear .+ team,$',
  flags: 'm',
  message: 'Address a named person when you can.',
};
const blockGreeting = { ...warnOnGreeting, id: 'greeting-block', severity: 'error' };

async function draftAndReview(request: Awaited<ReturnType<typeof setup>>['request']) {
  await request('/profile', 'PUT', {
    name: 'profile.md',
    content: '# Avery Example\n\n- Built React interfaces.\n',
  });
  const { result: card } = await request<Card>('/cards', 'POST', {
    company: 'Fixture Co',
    title: 'React Engineer',
    description: 'Build React interfaces.',
  });
  await request(`/cards/${card.id}/move`, 'POST', { state: 'shortlisted' });
  const { result: writer } = await request<Run>(`/cards/${card.id}/run`, 'POST', {
    roleId: 'writer',
  });
  await finish(request, writer.id);
  const { result: reviewer } = await request<Run>(`/cards/${card.id}/run`, 'POST', {
    roleId: 'reviewer',
  });
  const snapshot = await finish(request, reviewer.id);
  return snapshot.cards.find((item) => item.id === card.id)!;
}

describe('packet rules', () => {
  it('uses the defaults without a file and lets only the UI session change rules', async () => {
    const { daemon, request, directory } = await setup(15371);
    const before = await daemon.service.snapshot();
    expect(before.packetRules).toEqual({ rules: defaultPacketRules, custom: false, error: null });
    expect((await request<PacketRulesState>('/packet-rules')).result.custom).toBe(false);

    const invalid = {
      version: 1,
      rules: [{ ...houseRules.rules[1], pattern: '(\\w+\\s?)*' }],
    };
    const checked = await request<{ valid: boolean; issues: PacketRuleIssue[] }>(
      '/packet-rules/validate',
      'POST',
      invalid,
    );
    expect(checked.response.status).toBe(200);
    expect(checked.result).toEqual({
      valid: false,
      issues: [
        { path: ['rules', 0, 'pattern'], message: expect.stringContaining('Nested repeats') },
      ],
    });
    const rejected = await request<{ error: string; issues: PacketRuleIssue[] }>(
      '/packet-rules',
      'PUT',
      invalid,
    );
    expect(rejected.response.status).toBe(400);
    expect(rejected.result.issues).toEqual(checked.result.issues);
    await expect(readFile(join(directory, 'packet-rules.json'))).rejects.toThrow();

    const saved = await request<PacketRulesState>('/packet-rules', 'PUT', houseRules);
    expect(saved.response.status).toBe(200);
    expect(saved.result).toEqual({ rules: houseRules, custom: true, error: null });
    expect(JSON.parse(await readFile(join(directory, 'packet-rules.json'), 'utf8'))).toEqual(
      houseRules,
    );
    expect((await request<Snapshot>('/snapshot')).result.packetRules?.rules).toEqual(houseRules);

    for (const headers of <Record<string, string>[]>[
      { cookie: '' },
      { origin: 'https://evil.example' },
      { 'x-pitchcrew-client': '' },
    ])
      expect(
        (await request('/packet-rules', 'PUT', defaultPacketRules, headers)).response.status,
      ).toBe(403);
    daemon.service.capabilities.set('fixture-token', {
      runId: 'fixture',
      cardId: null,
      roleId: 'writer',
    });
    const agent = await fetch(`${daemon.url}/api/packet-rules`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer fixture-token', 'x-pitchcrew-client': 'ui' },
    });
    expect(agent.status).toBe(403);
    await expect(
      daemon.service.agentCall('fixture-token', 'save_packet_rules', { input: defaultPacketRules }),
    ).rejects.toThrow('This tool is not allowed.');
    expect(daemon.service.packetRules.current().rules).toEqual(houseRules);

    const after = await daemon.service.snapshot();
    expect(after.events).toEqual(before.events);
    const reset = await request<PacketRulesState>('/packet-rules', 'DELETE');
    expect(reset.result).toEqual({ rules: defaultPacketRules, custom: false, error: null });
  });

  it('fails closed when the rules file is edited into an invalid state', async () => {
    const { daemon, directory } = await setup(15372);
    const path = join(directory, 'packet-rules.json');
    await writeFile(path, '{"version":1,"rules":[');
    expect(daemon.service.packetRules.current()).toMatchObject({
      custom: true,
      error: 'packet-rules.json is not valid JSON.',
    });
    await writeFile(
      path,
      JSON.stringify({ version: 1, rules: [{ ...houseRules.rules[1], pattern: '(a+)+' }] }),
    );
    const state = daemon.service.packetRules.current();
    expect(state.error).toContain('rules.0.pattern: Nested repeats');
    const { packet } = await import('../../board/test/fixtures/packet.ts');
    const check = await daemon.service.packetRules.check(packet, [
      { name: 'profile.md', content: 'Built React interfaces.' },
    ]);
    expect(check.errors).toEqual([expect.stringContaining('Fix it in Settings')]);
    await writeFile(path, JSON.stringify(houseRules));
    expect(daemon.service.packetRules.current()).toEqual({
      rules: houseRules,
      custom: true,
      error: null,
    });
  });

  it('fails closed when the rules path cannot be inspected', async () => {
    const { daemon, directory } = await setup(15375);
    await symlink('packet-rules.json', join(directory, 'packet-rules.json'));
    expect(daemon.service.packetRules.current()).toMatchObject({
      custom: true,
      error: expect.any(String),
    });
  });
  it('refreshes same-size rules edits even when their modification time is preserved', async () => {
    const { daemon, directory } = await setup(15377);
    const path = join(directory, 'packet-rules.json');
    const timestamp = new Date('2026-01-01T00:00:00Z');
    const original = { version: 1, rules: [{ ...houseRules.rules[1], pattern: 'first' }] };
    await writeFile(path, JSON.stringify(original));
    await utimes(path, timestamp, timestamp);
    expect(daemon.service.packetRules.current().rules.rules[0]).toMatchObject({ pattern: 'first' });
    await writeFile(
      path,
      JSON.stringify({ ...original, rules: [{ ...original.rules[0], pattern: 'other' }] }),
    );
    await utimes(path, timestamp, timestamp);
    expect(daemon.service.packetRules.current().rules.rules[0]).toMatchObject({ pattern: 'other' });
  });
  it('bounds slow regex checks while keeping HTTP and approved exports responsive', async () => {
    const { daemon, request } = await setup(15376);
    const agreed = await draftAndReview(request);
    const slowPacket = { ...agreed.packet!, resume: `Built React interfaces.\n${'a'.repeat(40)}!` };
    daemon.service.board.updateCard(agreed.id, { packet: slowPacket }, 'user', 'Fixture packet');
    const { result: approval } = await request<Approval>(`/cards/${agreed.id}/approval`, 'POST');
    await request(`/approvals/${approval.id}/decide`, 'POST', { approved: true });
    await request('/packet-rules', 'PUT', {
      version: 1,
      rules: [
        {
          id: 'slow',
          kind: 'pattern',
          severity: 'warn',
          documents: ['resume'],
          pattern: '(a|aa)+b',
        },
      ],
    });
    const pending = daemon.service.packetRules.check(slowPacket, [
      { name: 'profile.md', content: 'Built React interfaces.' },
    ]);
    const started = Date.now();
    expect((await request('/packet-rules')).response.status).toBe(200);
    expect(Date.now() - started).toBeLessThan(1000);
    expect((await pending).errors).toEqual([expect.stringContaining('timed out')]);
    const blocked = await request<{ error: string }>(`/approvals/${approval.id}/export`, 'POST');
    expect(blocked.response.status).toBe(400);
    expect(blocked.result.error).toContain('timed out');
    expect(daemon.service.board.get<Approval>('approval', approval.id).status).toBe('approved');
    await request('/packet-rules', 'DELETE');
    expect((await request(`/approvals/${approval.id}/export`, 'POST')).response.status).toBe(200);
  });
  it('shows warnings without blocking review and blocks drafts and exports on errors', async () => {
    const { daemon, request } = await setup(15373);
    await request('/packet-rules', 'PUT', {
      version: 1,
      rules: [...houseRules.rules, warnOnGreeting],
    });
    const agreed = await draftAndReview(request);
    expect(agreed.state).toBe('agreed');
    expect(agreed.feedback).toEqual([
      'Warning: Address a named person when you can. (Cover letter: 1 match, "Dear Fixture Co team,")',
    ]);

    const { result: approval } = await request<Approval>(`/cards/${agreed.id}/approval`, 'POST');
    await request(`/approvals/${approval.id}/decide`, 'POST', { approved: true });
    await request('/packet-rules', 'PUT', { version: 1, rules: [blockGreeting] });
    const blocked = await request<{ error: string }>(`/approvals/${approval.id}/export`, 'POST');
    expect(blocked.response.status).toBe(400);
    expect(blocked.result.error).toContain('no longer passes its checks');
    expect(blocked.result.error).toContain('Address a named person');
    expect(daemon.service.board.get<Approval>('approval', approval.id).status).toBe('approved');

    await request(`/cards/${agreed.id}/move`, 'POST', { state: 'changes_requested' });
    const { result: writer } = await request<Run>(`/cards/${agreed.id}/run`, 'POST', {
      roleId: 'writer',
    });
    let failed: Run | undefined;
    for (let i = 0; i < 80 && !failed; i++) {
      const { result } = await request<Snapshot>('/snapshot');
      failed = result.runs.find((run) => run.id === writer.id && run.status !== 'running');
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    expect(failed).toMatchObject({ status: 'failed' });
    expect(failed?.message).toContain('Address a named person');
    expect(daemon.service.board.get<Card>('card', agreed.id).state).toBe('changes_requested');

    await request('/packet-rules', 'DELETE');
    const { result: retry } = await request<Run>(`/cards/${agreed.id}/run`, 'POST', {
      roleId: 'writer',
    });
    await finish(request, retry.id);
    expect(daemon.service.board.get<Card>('card', agreed.id)).toMatchObject({
      state: 'in_review',
      feedback: [],
    });
  });

  it('lets agents read rules and check drafts with findings', async () => {
    const { daemon, request } = await setup(15374);
    await request('/packet-rules', 'PUT', { version: 1, rules: [warnOnGreeting] });
    daemon.service.capabilities.set('fixture-token', {
      runId: 'fixture',
      cardId: null,
      roleId: 'writer',
    });
    const rules = await daemon.service.agentCall('fixture-token', 'packet_rules', {});
    expect(rules).toMatchObject({ custom: true, error: null, rules: { version: 1 } });
    expect(rules.summary).toContain('- greeting-style (warn) Cover letter: at most 0 matches');
    await daemon.service.saveProfile('profile.md', '- Built React interfaces.');
    const { packet } = await import('../../board/test/fixtures/packet.ts');
    const lint = await daemon.service.agentCall('fixture-token', 'lint', {
      packet: { ...packet, coverLetter: 'Dear Fixture Co team,\nBuilt React interfaces.' },
    });
    expect(lint).toEqual({
      problems: [],
      warnings: [
        'Address a named person when you can. (Cover letter: 1 match, "Dear Fixture Co team,")',
      ],
      findings: [
        {
          ruleId: 'greeting-style',
          severity: 'warn',
          document: 'coverLetter',
          message:
            'Address a named person when you can. (Cover letter: 1 match, "Dear Fixture Co team,")',
        },
      ],
    });
  });
});
