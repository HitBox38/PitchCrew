import { type Role, type RuntimeId, type Skill } from '@pitchcrew/core';
import { defaultRoles } from './default-roles.ts';
import type { BoardContext } from './types.ts';

export function seedRoles(this: BoardContext, runtime: RuntimeId = 'demo', enabled = true): void {
  this.db.transaction(() => {
    const existing = this.list<Role>('role');
    const sharedSize = this.list<Skill>('skill')
      .filter((skill) => !skill.deletedAt && skill.scope === 'all')
      .reduce(
        (size, skill) => size + skill.name.length + skill.description.length + skill.content.length,
        0,
      );
    // Preserve creation limits even in workspaces where all previous roles were retired.
    if (sharedSize > 60000) return;
    const missing = defaultRoles(runtime, enabled)
      .filter((role) => !existing.some((saved) => saved.id === role.id))
      .slice(0, Math.max(0, 50 - existing.length));
    for (const role of missing) this.record('role', role, 'system', `Initialized ${role.name}`);
  })();
}
