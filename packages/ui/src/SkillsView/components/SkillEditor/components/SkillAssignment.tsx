import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { toggleAssignment } from '@/SkillsView/helpers.ts';
import type { RoleId } from '@pitchcrew/core';
import type { SkillEditorModel } from '../types.ts';

/** Assignment chips: All agents, or any set of current agents. */
export const SkillAssignment = ({
  scope,
  setScope,
  roles,
  roleIds,
  setRoleIds,
}: SkillEditorModel) => {
  const toggle = (target: RoleId | 'all') => {
    const next = toggleAssignment({ scope, roleIds }, target);
    setScope(next.scope);
    setRoleIds(next.roleIds);
  };
  const selected = new Set(roleIds);
  return (
    <fieldset className="skills-assign">
      <legend>Used by</legend>
      <div className="skills-assign-chips">
        <Button
          className="skills-assign-chip"
          aria-pressed={scope === 'all'}
          onClick={() => toggle('all')}
        >
          All agents
        </Button>
        {roles
          .filter((role) => !role.retiredAt)
          .map((role) => (
            <Button
              key={role.id}
              className="skills-assign-chip"
              aria-pressed={scope === 'roles' && selected.has(role.id)}
              onClick={() => toggle(role.id)}
            >
              <RoleAvatar agentRole={role.id} size="small" />
              {role.name}
            </Button>
          ))}
      </div>
      {scope === 'all' ? (
        <p className="skills-assign-note">Every current and future agent receives this skill.</p>
      ) : null}
    </fieldset>
  );
};
