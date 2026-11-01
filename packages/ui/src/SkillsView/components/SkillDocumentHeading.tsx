import { Button } from '@/components/ui/button/components/Button.tsx';
import { timeAgo } from '@/lib/time.ts';
import type { SkillsViewModel } from '@/SkillsView/types.ts';
import { starterNote } from '../helpers.ts';
import { SkillAssignedChips } from './SkillAssignedChips.tsx';
import { SkillUpdate } from './SkillUpdate/index.tsx';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';

export const SkillDocumentHeading = (c: SkillsViewModel) => {
  const skill = c.selected;
  if (!skill) return null;
  const note = starterNote(skill);
  return (
    <header className="skills-pane-head">
      <Button
        className="icon-button skills-back"
        aria-label="Back to skills"
        onClick={() => c.setSelectedId(null)}
      >
        <ArrowLeft size={16} />
      </Button>
      <div className="skills-pane-title">
        <h2>{skill.name}</h2>
        <p>
          Made by {c.creator(skill)} · Updated {timeAgo(skill.updatedAt)}
          {skill.source ? (
            <span className="skills-source">
              {' '}
              · {skill.source.repository}/{skill.source.path}
            </span>
          ) : null}
        </p>
        {note ? <p>{note}</p> : null}
        <SkillAssignedChips skill={skill} roles={c.data.roles} />
      </div>
      <div className="skills-pane-actions">
        {skill.source ? (
          <SkillUpdate
            key={skill.id}
            skill={skill}
            action={c.action}
            working={c.working}
            requested={c.reviewId === skill.id}
            onReviewClose={c.onReviewClose}
          />
        ) : null}
        <Button
          className="button small"
          aria-label={`Edit ${skill.name}`}
          onClick={() => c.setEditing(skill)}
          disabled={c.working}
        >
          <Pencil size={14} aria-hidden="true" /> Edit
        </Button>
        <Button
          className="icon-button"
          aria-label={`Delete ${skill.name}`}
          disabled={c.working}
          onClick={() => {
            c.setError('');
            c.setDeleting(skill);
          }}
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </header>
  );
};
