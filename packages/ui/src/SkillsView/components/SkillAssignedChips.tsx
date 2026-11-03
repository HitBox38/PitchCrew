import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import type { Role, Skill } from '@pitchcrew/core';
import { assignedRoles } from '../helpers.ts';

/** Read-only assignment: one chip per agent with its pebble, or All agents. */
export const SkillAssignedChips = ({ skill, roles }: { skill: Skill; roles: Role[] }) => {
  return (
    <ul className="skills-chips" aria-label="Available to">
      {skill.scope === 'all' ? (
        <li className="ui-chip">All agents</li>
      ) : (
        assignedRoles(skill, roles).map((role) => (
          <li key={role.id} className="ui-chip">
            <RoleAvatar agentRole={role.id} size="small" />
            {role.name}
          </li>
        ))
      )}
    </ul>
  );
};
