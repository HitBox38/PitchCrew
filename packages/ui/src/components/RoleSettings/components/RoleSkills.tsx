import type { RoleSkillsProps } from '@/components/RoleSettings/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';

/** Shared and assigned skills that new runs copy; assignments are managed on Skills. */
export const RoleSkills = ({ role, data, onManageSkills }: RoleSkillsProps) => {
  const skills = data.skills.filter(
    (skill) => !skill.deletedAt && (skill.scope === 'all' || skill.roleIds.includes(role.id)),
  );
  return (
    <section
      className="agent-panel-section"
      id="agent-skills"
      aria-labelledby={`${role.id}-skills-heading`}
    >
      <h3 id={`${role.id}-skills-heading`}>
        Skills <span className="ui-count">{skills.length}</span>
      </h3>
      {skills.length ? (
        <ul className="role-skill-list">
          {skills.map((skill) => (
            <li key={skill.id} className="ui-chip" title={skill.description}>
              {skill.name}
              {skill.scope === 'all' ? <span className="agent-skill-scope">All agents</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="optional">No skills apply to {role.name} yet.</p>
      )}
      <Button className="button small self-start" onClick={onManageSkills}>
        Manage skills
      </Button>
    </section>
  );
};
