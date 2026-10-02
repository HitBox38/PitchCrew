import { Button } from '@/components/ui/button/components/Button.tsx';
import { timeAgo } from '@/lib/time.ts';
import { assignment, starterNote } from '@/SkillsView/helpers.ts';
import type { SkillLibraryProps } from '@/SkillsView/types.ts';
import { BookOpen, Pencil, Trash2 } from 'lucide-react';

export function SkillLibrary({
  skills,
  creator,
  data,
  setEditing,
  working,
  setError,
  setDeleting,
}: SkillLibraryProps) {
  return (
    <ul className="skill-library">
      {skills.map((skill) => (
        <li className="skill-row" key={skill.id}>
          <BookOpen size={20} className="skill-mark" aria-hidden="true" />
          <div className="skill-summary">
            <h2>{skill.name}</h2>
            {skill.description ? <p>{skill.description}</p> : null}
            {starterNote(skill) ? <p className="quiet">{starterNote(skill)}</p> : null}
            <div className="skill-meta">
              <span>Made by {creator(skill)}</span>
              <span className="badge">{assignment(skill, data.roles)}</span>
              {skill.source ? <span className="badge">skills.sh</span> : null}
              <span>Updated {timeAgo(skill.updatedAt)}</span>
            </div>
          </div>
          <div className="skill-actions">
            <Button
              className="button small"
              aria-label={`Edit ${skill.name}`}
              onClick={() => setEditing(skill)}
              disabled={working}
            >
              <Pencil size={14} /> Edit
            </Button>
            <Button
              className="icon-button"
              aria-label={`Delete ${skill.name}`}
              disabled={working}
              onClick={() => {
                setError('');
                setDeleting(skill);
              }}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
