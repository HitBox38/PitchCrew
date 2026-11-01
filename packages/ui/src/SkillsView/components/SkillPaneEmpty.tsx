import { Button } from '@pitchcrew/design-system/button';
import type { SkillsViewModel } from '@/SkillsView/types.ts';

/** Nothing to read yet: the pane keeps its document sheet with one top-aligned sentence. */
export const SkillPaneEmpty = (c: SkillsViewModel) => {
  const none = !c.data.skills.length;
  const browse = () => {
    c.setStartersOpen(true);
    // The starter list opens at the bottom of the library; bring it into view for the user.
    requestAnimationFrame(() => {
      const trigger = document.querySelector<HTMLElement>('.skills-starters-trigger');
      trigger?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      trigger?.focus({ preventScroll: true });
    });
  };
  return (
    <section
      className="skills-pane skills-pane-empty"
      data-none={none || undefined}
      aria-label={none ? 'No skills yet' : 'No skill selected'}
    >
      <div className="skills-sheet">
        <div className="skills-sheet-empty">
          <p>
            {none
              ? 'Skills are reusable instructions your crew follows.'
              : 'No skill matches these filters.'}
          </p>
          {none ? (
            <Button className="button" onClick={browse}>
              Browse starter skills
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
};
