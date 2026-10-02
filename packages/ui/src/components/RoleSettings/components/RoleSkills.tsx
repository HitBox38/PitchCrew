import type { RoleSkillsProps } from '@/components/RoleSettings/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';

export function RoleSkills({ role, data, onManageSkills }: RoleSkillsProps) {
  return (
    <section className="role-settings-section" aria-labelledby={`${role.id}-skills-heading`}>
      <h3 id={`${role.id}-skills-heading`}>Skills</h3>
      <p className="quiet">Shared skills and skills assigned to {role.name} apply to new runs.</p>
      <ul className="role-skill-list">
        {data.skills
          .filter((skill) => skill.scope === 'all' || skill.roleIds.includes(role.id))
          .map((skill) => (
            <li key={skill.id}>
              <strong>{skill.name}</strong>
              <span className="badge">{skill.scope === 'all' ? 'All agents' : role.name}</span>
            </li>
          ))}
      </ul>
      <Button className="button" onClick={onManageSkills}>
        Manage skills
      </Button>
    </section>
  );
}
