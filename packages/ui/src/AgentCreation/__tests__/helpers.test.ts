import { describe, expect, it } from 'vitest';
import type { Role, Snapshot } from '@pitchcrew/core';
import {
  creationInput,
  initialCreation,
  setupWarnings,
  stepError,
  suggestedId,
} from '../helpers.ts';
import { roleSetup } from '../../../../orchestrator/src/crew/role-setup.ts';

const data = {
  roles: [],
  skills: [],
  connectors: [],
  runtimes: [{ id: 'demo', available: true }],
} as unknown as Snapshot;
describe('agent setup decisions', () => {
  it('uses a listed real runtime when production has no installed runtimes', () => {
    const production = { ...data, runtimes: [{ id: 'claude-code', available: false }] } as Snapshot;
    expect(initialCreation(production).role.runtime).toBe('claude-code');
    expect(initialCreation(data).role.runtime).toBe('demo');
  });
  it('keeps arbitrary responsibilities generic and the optional routine bound to the final edited role ID', () => {
    const draft = initialCreation(data);
    draft.role = {
      ...draft.role,
      id: 'learning-partner',
      name: 'Learning partner',
      description: 'Explain technical concepts.',
    };
    expect(roleSetup.parse(creationInput(draft))).toMatchObject({
      workflow: 'chat',
      capabilities: { invokeAgents: false, computerUse: false },
      skills: [],
    });
    expect(creationInput(draft)).not.toHaveProperty('routine');
    draft.scheduled = true;
    draft.routine = {
      ...draft.routine,
      roleId: 'old-id',
      name: 'Weekly review',
      content: 'Review concepts.',
      timezone: 'UTC',
      startLocal: '2030-01-01T09:00:00',
      frequency: 'weekly',
    };
    expect(roleSetup.parse(creationInput(draft)).routine).toMatchObject({
      roleId: 'learning-partner',
      enabled: false,
      cron: '0 9 * * 2',
      startAt: '2030-01-01T09:00:00.000Z',
    });
  });
  it('avoids retired identities and reserved or unsafe generated IDs', () => {
    expect(
      suggestedId('Research Partner!', [{ id: 'research-partner', retiredAt: '2030' } as Role]),
    ).toBe('research-partner-2');
    for (const name of ['CON', '123 helper', '研究', ''])
      expect(suggestedId(name, [])).toBe('new-agent');
    expect(suggestedId('A'.repeat(100), [])).toHaveLength(42);
  });
  it('allows paused setup without an installed runtime and flags missing access without silently granting it', () => {
    const draft = initialCreation(data);
    draft.role.runtime = 'codex';
    expect(stepError(1, draft, data)).toContain('available runtime');
    draft.role.enabled = false;
    expect(stepError(1, draft, data)).toBe('');
    draft.role.capabilities = {
      ...draft.role.capabilities!,
      trackApplications: true,
      recordSubmissions: true,
      proposeCrewChanges: true,
    };
    expect(setupWarnings(draft, data)).toEqual(
      expect.arrayContaining([
        'Email reconciliation needs Gmail access.',
        'Crew change proposals need pipeline review access.',
        'Form assessment and submission recording need browser access.',
      ]),
    );
    expect(draft.role.capabilities.gmail).toBe(false);
    expect(draft.role.capabilities.computerUse).toBe(false);
  });
  it('requires another review when a selected skill is removed or changed', () => {
    const draft = initialCreation(data);
    draft.skills = [{ id: 'removed', updatedAt: '2030-01-01T00:00:00Z' }];
    expect(stepError(3, draft, data)).toContain('changed or was removed');
  });
});
