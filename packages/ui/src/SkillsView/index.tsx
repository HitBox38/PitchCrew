import { EmptyState } from '@/components/EmptyState/index.tsx';
import { SkillDialogs } from '@/SkillsView/components/SkillDialogs.tsx';
import { SkillFilters } from '@/SkillsView/components/SkillFilters.tsx';
import { SkillLibrary } from '@/SkillsView/components/SkillLibrary.tsx';
import { SkillsToolbar } from '@/SkillsView/components/SkillsToolbar.tsx';
import { StarterSkillErrors } from '@/SkillsView/components/StarterSkillErrors.tsx';
import { StarterSkills } from '@/SkillsView/components/StarterSkills.tsx';
import { useSkillsView } from '@/SkillsView/hooks/useSkillsView.ts';
import type { SkillsViewProps } from '@/SkillsView/types.ts';

export function SkillsView(props: SkillsViewProps) {
  const controller = useSkillsView(props);
  const { data, skills } = controller;
  return (
    <section className="skills-view" aria-label="Skill library">
      <SkillsToolbar {...controller} />
      <SkillFilters {...controller} />
      <p className="quiet skills-guidance">
        Skills are reusable Markdown instructions. Agent views include shared skills. Updates apply
        to the next chat or job run.
      </p>
      {data.starterSkillErrors?.length ? <StarterSkillErrors {...controller} /> : null}
      {data.skills.length ? (
        <output className="skills-result-count">
          {skills.length} of {data.skills.length} {data.skills.length === 1 ? 'skill' : 'skills'}
        </output>
      ) : null}
      {skills.length ? (
        <SkillLibrary {...controller} />
      ) : (
        <EmptyState
          title={data.skills.length ? 'No matching skills' : 'Teach your crew a skill'}
          description={
            data.skills.length
              ? 'Try another search or agent filter.'
              : 'Add a writing style, a research method, or a review checklist. Share it with every agent or choose who uses it.'
          }
        />
      )}
      <StarterSkills {...controller} />
      <SkillDialogs {...controller} />
    </section>
  );
}
