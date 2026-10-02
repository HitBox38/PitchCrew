import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import type { SkillAssignmentProps } from '@/SkillsView/components/SkillEditor/types.ts';

export function SkillAssignment({
  scope,
  setScope,
  roles,
  roleIds,
  setRoleIds,
}: SkillAssignmentProps) {
  return (
    <section className="role-settings-section" aria-labelledby="skill-assignment-heading">
      <h3 id="skill-assignment-heading">Who uses this skill?</h3>
      <fieldset className="skill-filters" aria-label="Skill scope">
        <Button
          className={`button small ${scope === 'all' ? 'active' : ''}`}
          aria-pressed={scope === 'all'}
          onClick={() => setScope('all')}
        >
          All agents
        </Button>
        <Button
          className={`button small ${scope === 'roles' ? 'active' : ''}`}
          aria-pressed={scope === 'roles'}
          onClick={() => setScope('roles')}
        >
          Choose agents
        </Button>
      </fieldset>
      {scope === 'roles' ? (
        <fieldset className="role-settings-capabilities">
          <legend>Assigned agents</legend>
          {roles.map((role) => (
            <label className="checkbox-label" key={role.id}>
              <Checkbox
                checked={roleIds.includes(role.id)}
                onCheckedChange={(checked) =>
                  setRoleIds((current) =>
                    checked ? [...current, role.id] : current.filter((id) => id !== role.id),
                  )
                }
              />
              <RoleAvatar agentRole={role.id} size="small" />
              {role.name}
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="quiet">Scout, Writer, and Reviewer will all receive this skill.</p>
      )}
    </section>
  );
}
