import { DeleteSkill } from '@/SkillsView/components/DeleteSkill.tsx';
import { SkillLibrary } from '@/SkillsView/components/SkillLibrary.tsx';
import { SkillPane } from '@/SkillsView/components/SkillPane.tsx';
import { SkillsToolbar } from '@/SkillsView/components/SkillsToolbar.tsx';
import { useSkillsView } from '@/SkillsView/hooks/useSkillsView.ts';
import type { SkillsViewProps } from '@/SkillsView/types.ts';

/** Library beside the skill document; narrow widths push from the list into one skill. */
export const SkillsView = (props: SkillsViewProps) => {
  const c = useSkillsView(props);
  return (
    <section className="skills-view" data-detail={c.showingDetail || undefined}>
      <SkillsToolbar {...c} />
      <div className="skills-panes">
        <SkillLibrary {...c} />
        <SkillPane {...c} />
      </div>
      <DeleteSkill {...c} />
    </section>
  );
};
