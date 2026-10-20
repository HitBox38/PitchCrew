import { lazy, Suspense } from 'react';
import { MarkdownStatus } from '@/components/MarkdownEditor/components/MarkdownStatus.tsx';
import type { SkillPreviewProps } from '@/SkillsView/types.ts';
import { SkillDocumentHeading } from './SkillDocumentHeading.tsx';
import { SkillDocumentInfo } from './SkillDocumentInfo.tsx';

export const SkillPreview = (c: SkillPreviewProps) => {
  const skill = c.selected;
  if (!skill) return null;
  return (
    <article className="profile-editor skill-document" aria-label={`${skill.name} instructions`}>
      <SkillDocumentHeading {...c} />
      <div className="profile-preview-panel skill-document-scroll">
        <SkillDocumentInfo skill={skill} roles={c.data.roles} />
        <section className="skill-instructions-preview" aria-label="Instructions">
          <Suspense fallback={<p className="quiet">Opening instructions…</p>}>
            <MarkdownPreview content={skill.content} />
          </Suspense>
        </section>
      </div>
      <MarkdownStatus content={skill.content} status="Used in future runs" />
    </article>
  );
};

const MarkdownPreview = lazy(
  () => import('@/components/MarkdownEditor/components/MarkdownPreview.tsx'),
);
