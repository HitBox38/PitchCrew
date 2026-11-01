import { Button } from '@/components/ui/button/components/Button.tsx';
import { availableSkillUpdates } from '@/lib/skill-updates.ts';
import type { SkillsViewModel } from '@/SkillsView/types.ts';
import { SkillRow } from './SkillRow.tsx';
import { SkillUpdates } from './SkillUpdates.tsx';
import { StarterSkills } from './StarterSkills.tsx';

/** Recessed library: waiting updates first, the saved skills, then the starter catalog. */
export const SkillLibrary = (c: SkillsViewModel) => {
  const failed = (c.data.skillUpdates?.checks ?? []).some((check) => check.error);
  const updates = availableSkillUpdates(c.data).length > 0 || failed;
  return (
    <aside className="skills-library" aria-label="Skill library">
      <div className="skills-library-scroll">
        {updates ? <SkillUpdates {...c} /> : null}
        {c.skills.length ? (
          <ul className="skills-list" aria-label="Saved skills">
            {c.skills.map((skill) => (
              <SkillRow key={skill.id} skill={skill} c={c} />
            ))}
          </ul>
        ) : c.data.skills.length ? (
          <div className="skills-filtered-empty">
            <span>No skills match these filters.</span>
            <Button className="button small" onClick={c.clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : null}
        {updates ? null : <SkillUpdates {...c} compact />}
        <StarterSkills {...c} />
      </div>
    </aside>
  );
};
