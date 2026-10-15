import { Button } from '@/components/ui/button/components/Button.tsx';
import { timeAgo } from '@/lib/time.ts';
import type { SkillPreviewProps } from '@/SkillsView/types.ts';
import { SkillUpdate } from './SkillUpdate/index.tsx';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';

export function SkillDocumentHeading(c: SkillPreviewProps) {
  const skill = c.selected;
  if (!skill) return null;
  return (
    <header className="skill-document-heading">
      <Button
        className="icon-button skill-back"
        aria-label="Back to skills"
        onClick={() => c.setSelectedId(null)}
      >
        <ArrowLeft size={16} />
      </Button>
      <div>
        <h2>{skill.name}</h2>
        <p>
          Made by {c.creator(skill)} · Updated {timeAgo(skill.updatedAt)}
        </p>
      </div>
      <div className="skill-actions">
        {skill.source ? (
          <SkillUpdate key={skill.id} skill={skill} action={c.action} working={c.working} />
        ) : null}
        <Button
          className="button small"
          aria-label={`Edit ${skill.name}`}
          onClick={() => c.setEditing(skill)}
          disabled={c.working}
        >
          <Pencil size={14} /> Edit
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
}
