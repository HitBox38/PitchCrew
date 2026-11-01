import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import type { SkillsViewModel } from '@/SkillsView/types.ts';
import type { Skill } from '@pitchcrew/core';
import { assignedRoles, assignment } from '../helpers.ts';

/** A 64px library row: name and update mark, one-line description, Made by and assignment. */
export const SkillRow = ({ skill, c }: { skill: Skill; c: SkillsViewModel }) => {
  const roles = assignedRoles(skill, c.data.roles);
  const update = c.pending.has(skill.id);
  return (
    <li>
      <button
        type="button"
        className="skills-row"
        aria-pressed={c.selected?.id === skill.id}
        onClick={() => c.setSelectedId(skill.id)}
      >
        <span className="skills-row-name">
          <span>{skill.name}</span>
          {update ? (
            <span className="skills-update-mark">
              <span className="sr-only">Update available</span>
            </span>
          ) : null}
        </span>
        {skill.description ? (
          <span className="skills-row-description">{skill.description}</span>
        ) : null}
        <span className="skills-row-meta">
          <span>Made by {c.creator(skill)}</span>
          {skill.scope === 'all' ? (
            <span className="skills-row-all">
              All<span className="sr-only"> agents</span>
            </span>
          ) : (
            <span className="skills-pebbles" title={assignment(skill, c.data.roles)}>
              <span className="sr-only">Used by {assignment(skill, c.data.roles)}</span>
              {roles.slice(0, 4).map((role) => (
                <RoleAvatar key={role.id} agentRole={role.id} size="small" />
              ))}
              {roles.length > 4 ? <span>+{roles.length - 4}</span> : null}
            </span>
          )}
        </span>
      </button>
    </li>
  );
};
