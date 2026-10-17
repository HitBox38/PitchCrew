import { EmptyState } from '@/components/EmptyState/index.tsx';
import { SkillDialogs } from '@/SkillsView/components/SkillDialogs.tsx';
import { SkillFilters } from '@/SkillsView/components/SkillFilters.tsx';
import { SkillLibrary } from '@/SkillsView/components/SkillLibrary.tsx';
import { SkillPreview } from '@/SkillsView/components/SkillPreview.tsx';
import { SkillsToolbar } from '@/SkillsView/components/SkillsToolbar.tsx';
import { StarterSkillErrors } from '@/SkillsView/components/StarterSkillErrors.tsx';
import { StarterSkills } from '@/SkillsView/components/StarterSkills.tsx';
import { useSkillsView } from '@/SkillsView/hooks/useSkillsView.ts';
import type { SkillsViewProps } from '@/SkillsView/types.ts';
import { SkillUpdates } from './components/SkillUpdates.tsx';

export function SkillsView(props: SkillsViewProps) {
  const controller = useSkillsView(props);
  const { data, skills, showingDetail, selected } = controller;
  return (
    <section
      className={`skills-view ${showingDetail ? 'showing-detail' : ''}`}
      aria-label="Skill library"
    >
      <div className="skills-controls">
        <SkillsToolbar {...controller} />
        <SkillFilters {...controller} />
      </div>
      <div className="max-h-[35%] shrink-0 overflow-y-auto border-b border-border px-4 py-3">
        <SkillUpdates {...controller} />
      </div>
      <div className="skills-workspace">
        <aside className="skills-explorer" aria-label="Skill explorer">
          <div className="skills-explorer-heading">
            <h2>Library</h2>
            <output className="skills-result-count">
              {skills.length} of {data.skills.length} skills
            </output>
          </div>
          <div className="skills-explorer-scroll">
            {data.starterSkillErrors?.length ? <StarterSkillErrors {...controller} /> : null}
            {skills.length ? (
              <SkillLibrary {...controller} />
            ) : (
              <EmptyState
                title={data.skills.length ? 'No matching skills' : 'Teach your crew a skill'}
                description={
                  data.skills.length
                    ? 'Try another search or agent filter.'
                    : 'Add reusable instructions or choose a starter skill below.'
                }
              />
            )}
            <StarterSkills {...controller} />
          </div>
        </aside>
        {selected ? (
          <SkillPreview {...controller} />
        ) : (
          <div className="skill-document skill-document-empty">
            <EmptyState
              title="Reusable ways of working"
              description="Choose a skill to read its instructions, check who uses it, and make updates for future runs."
            />
          </div>
        )}
      </div>
      <SkillDialogs {...controller} />
    </section>
  );
}
