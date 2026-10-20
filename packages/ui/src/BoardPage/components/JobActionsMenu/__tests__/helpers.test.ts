import { describe, expect, it } from 'vitest';
import type { ApplicationContext, Card, Role, Run, RuntimeInfo, Snapshot } from '@pitchcrew/core';
import { states } from '@pitchcrew/core/states';
import { crewShortcut, quickStatuses, shortcutLabels } from '../helpers.ts';

const card = { id: 'job', state: 'lead', owner: null, packet: null } as Card;
const role = { id: 'custom-agent', workflow: 'scout', enabled: true, runtime: 'codex' } as Role;
const data = {
  roles: [role],
  runs: [],
  profile: [{ name: 'experience', content: 'Fictional experience' }],
  runtimes: [{ id: 'codex', available: true } as RuntimeInfo],
} as unknown as Snapshot;
const confirmed = {
  revision: 'context',
  confirmedRevision: 'context',
  confirmedAt: 'today',
} as ApplicationContext;

describe('board job actions', () => {
  it('offers stage-specific quick statuses without duplicates, the current status or unlabeled actions', () => {
    for (const state of states) {
      const shortcuts = quickStatuses(state);
      expect(shortcuts).not.toContain(state);
      expect(new Set(shortcuts).size).toBe(shortcuts.length);
      for (const target of shortcuts) expect(shortcutLabels[target]).toEqual(expect.any(String));
      if (['rejected', 'withdrawn', 'ghosted'].includes(state)) expect(shortcuts).toEqual([]);
      else expect(shortcuts).toContain('withdrawn');
    }
    expect(quickStatuses('lead')).toEqual(['shortlisted', 'withdrawn']);
    expect(quickStatuses('in_review')).toEqual(['submitted', 'withdrawn']);
    expect(quickStatuses('submitted')).toContain('interviewing');
    expect(quickStatuses('interviewing')).not.toContain('screening');
  });

  it('requires the existing brief flow before fit, drafting or review can start', () => {
    expect(crewShortcut(card, data)).toMatchObject({ label: 'Evaluate fit', needsBrief: true });
    expect(crewShortcut({ ...card, applicationContext: confirmed }, data)).toMatchObject({
      needsBrief: false,
    });
    const draft = { ...card, state: 'shortlisted' as const };
    const writer = { ...data, roles: [{ ...role, workflow: 'writer' as const }] };
    expect(crewShortcut(draft, writer)).toMatchObject({
      label: 'Draft application',
      roleId: role.id,
      draft: true,
      needsBrief: true,
    });
    expect(
      crewShortcut(
        { ...draft, applicationContext: { ...confirmed, confirmedRevision: 'old' } },
        writer,
      ),
    ).toMatchObject({ needsBrief: true });
    expect(crewShortcut({ ...draft, applicationContext: confirmed }, writer)).toMatchObject({
      needsBrief: false,
    });
    const review = {
      ...card,
      state: 'in_review' as const,
      packet: {} as NonNullable<Card['packet']>,
      applicationContext: confirmed,
    };
    expect(
      crewShortcut(review, { ...data, roles: [{ ...role, workflow: 'reviewer' }] }),
    ).toMatchObject({ label: 'Review packet', needsBrief: false });
    expect(crewShortcut({ ...card, state: 'submitted' }, data)).toBeNull();
  });

  it('blocks unavailable agents while allowing an agent busy on another job', () => {
    for (const roles of [[], [{ ...role, enabled: false }], [{ ...role, retiredAt: 'today' }]])
      expect(crewShortcut(card, { ...data, roles })?.reason).toContain('Enable an agent');
    expect(
      crewShortcut(card, { ...data, roles: [{ ...role, runtime: 'gemini-cli' }] })?.reason,
    ).toContain('isolated application');
    expect(crewShortcut(card, { ...data, runtimes: [] })?.reason).toContain('Install');
    expect(crewShortcut(card, { ...data, profile: [] })?.reason).toContain('profile notes');
    expect(
      crewShortcut(card, {
        ...data,
        runs: [{ roleId: role.id, cardId: 'other', status: 'running' } as Run],
      })?.reason,
    ).toBeUndefined();
    expect(crewShortcut({ ...card, owner: role.id }, data)?.reason).toContain('active work');
  });

  it('offers cancellation for active workflow and attached chat runs even if the role is unavailable', () => {
    for (const mode of ['workflow', 'chat'])
      expect(
        crewShortcut(card, {
          ...data,
          roles: [],
          runs: [{ id: 'active', cardId: card.id, status: 'running', mode } as Run],
        }),
      ).toEqual({ label: 'Cancel run', runId: 'active' });
  });
});
