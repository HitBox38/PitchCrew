import { assignment, starterNote } from '@/SkillsView/helpers.ts';
import type { Skill, Role } from '@pitchcrew/core';

export const SkillDocumentInfo = ({ skill, roles }: { skill: Skill; roles: Role[] }) => {
  return (
    <div className="skill-document-info">
      {skill.description ? <p>{skill.description}</p> : null}
      <dl>
        <div>
          <dt>Used by</dt>
          <dd>{assignment(skill, roles)}</dd>
        </div>
        {skill.source ? (
          <div>
            <dt>Source</dt>
            <dd>
              {skill.source.repository}
              <span className="skill-source-path">{skill.source.path}</span>
            </dd>
          </div>
        ) : null}
      </dl>
      {starterNote(skill) ? <p className="quiet">{starterNote(skill)}</p> : null}
    </div>
  );
};
