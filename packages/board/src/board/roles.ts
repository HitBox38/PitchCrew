import { type Role } from '@pitchcrew/core';
import type { BoardContext } from './types.ts';

export function seedRoles(this: BoardContext): void {
  const definitions: Role[] = [
    {
      id: 'scout',
      name: 'Scout',
      description: 'Find the fit before you invest the time.',
      runtime: 'demo',
      model: '',
      enabled: true,
      instructions:
        'Evaluate the provided job against the profile. Explain the fit. Never invent jobs or qualifications.',
    },
    {
      id: 'writer',
      name: 'Writer',
      description: 'Turn your experience into a clear application.',
      runtime: 'demo',
      model: '',
      enabled: true,
      instructions:
        'Write a tailored application packet. Every factual claim must appear verbatim in a profile source and include a source and quote. Never invent achievements.',
    },
    {
      id: 'reviewer',
      name: 'Reviewer',
      description: 'Keep every claim grounded in your profile.',
      runtime: 'demo',
      model: '',
      enabled: true,
      instructions:
        'Check every statement in the packet against the profile. Reject unverifiable claims and explain required changes. Review independently.',
    },
  ];
  if (!this.list<Role>('role').length)
    for (const role of definitions) this.record('role', role, 'system', `Initialized ${role.name}`);
}
