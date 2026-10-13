import { Button } from '@/components/ui/button/components/Button.tsx';
import { timeAgo } from '@/lib/time.ts';
import { assignment, starterNote } from '@/SkillsView/helpers.ts';
import type { SkillPreviewProps } from '@/SkillsView/types.ts';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Streamdown } from 'streamdown';

const markdownComponents = {
  img: ({ alt }: { alt?: string }) => <span className="quiet">[Image: {alt || 'image'}]</span>,
};

export function SkillPreview({
  selected: skill,
  creator,
  data,
  setEditing,
  working,
  setError,
  setDeleting,
  setSelectedId,
}: SkillPreviewProps) {
  if (!skill) return null;
  return (
    <article className="skill-document" aria-label={`${skill.name} instructions`}>
      <header className="skill-document-heading">
        <Button
          className="icon-button skill-back"
          aria-label="Back to skills"
          onClick={() => setSelectedId(null)}
        >
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h2>{skill.name}</h2>
          <p>
            Made by {creator(skill)} · Updated {timeAgo(skill.updatedAt)}
          </p>
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
      </header>
      <div className="skill-document-scroll">
        <div className="skill-document-info">
          {skill.description ? <p>{skill.description}</p> : null}
          <dl>
            <div>
              <dt>Used by</dt>
              <dd>{assignment(skill, data.roles)}</dd>
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
        <section className="skill-instructions-preview" aria-label="Instructions">
          <Streamdown mode="static" controls={false} components={markdownComponents}>
            {skill.content}
          </Streamdown>
        </section>
      </div>
      <footer className="skill-document-status">
        Instructions apply to the next chat or job run.
      </footer>
    </article>
  );
}
