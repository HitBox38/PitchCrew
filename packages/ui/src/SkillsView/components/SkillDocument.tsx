import { lazy, Suspense } from 'react';
import type { SkillsViewModel } from '@/SkillsView/types.ts';
import { SkillDocumentHeading } from './SkillDocumentHeading.tsx';

/** A saved skill read as a document: heading on the paper, rendered Markdown on the sheet. */
export const SkillDocument = (c: SkillsViewModel) => {
  const skill = c.selected;
  if (!skill) return null;
  return (
    <article className="skills-pane" aria-label={`${skill.name} instructions`}>
      <SkillDocumentHeading {...c} />
      <div className="skills-sheet">
        <div className="skills-sheet-scroll">
          {skill.description ? <p className="skills-sheet-lead">{skill.description}</p> : null}
          <section className="skills-markdown" aria-label="Instructions">
            <Suspense fallback={<p className="quiet">Opening instructions…</p>}>
              <MarkdownPreview content={skill.content} />
            </Suspense>
          </section>
        </div>
      </div>
    </article>
  );
};

const MarkdownPreview = lazy(
  () => import('@/components/MarkdownEditor/components/MarkdownPreview.tsx'),
);
