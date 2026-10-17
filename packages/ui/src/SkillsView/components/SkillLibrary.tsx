import { Button } from '@/components/ui/button/components/Button.tsx';
import { assignment } from '@/SkillsView/helpers.ts';
import type { SkillLibraryProps } from '@/SkillsView/types.ts';
import { FileText } from 'lucide-react';
import { pendingSkillUpdates } from '@/lib/skill-updates.ts';

export function SkillLibrary({
  skills,
  creator,
  data,
  selected,
  setSelectedId,
}: SkillLibraryProps) {
  const pending = new Set(pendingSkillUpdates(data).map((check) => check.skillId));
  return (
    <ul className="skill-library" aria-label="Saved skills">
      {skills.map((skill) => (
        <li className="skill-row" key={skill.id}>
          <Button
            className="skill-library-item"
            aria-pressed={selected?.id === skill.id}
            onClick={() => setSelectedId(skill.id)}
          >
            <FileText size={16} className="skill-mark" aria-hidden="true" />
            <span className="skill-summary">
              <span className="skill-name">{skill.name}</span>
              {pending.has(skill.id) ? (
                <span className="text-sm text-plum">Update available</span>
              ) : null}
              <span className="skill-meta">Made by {creator(skill)}</span>
              <span className="skill-assignment">{assignment(skill, data.roles)}</span>
            </span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
