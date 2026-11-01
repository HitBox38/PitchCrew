import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@pitchcrew/design-system/accordion';
import { Button } from '@pitchcrew/design-system/button';
import type { SkillsViewModel } from '@/SkillsView/types.ts';
import { baseSkills } from '@pitchcrew/core/base-skills';
import { StarterSkillErrors } from './StarterSkillErrors.tsx';

/** Starter catalog: a closed disclosure at the bottom of the library; each row is name, one line
 * of what it does, and a clay Add or Import. */
export const StarterSkills = (c: SkillsViewModel) => {
  const query = c.query.trim().toLowerCase();
  const starters = baseSkills.filter((item) =>
    `${item.name} ${item.description} ${item.source}`.toLowerCase().includes(query),
  );
  return (
    <section className="skills-starters" aria-label="Starter skills">
      {c.data.starterSkillErrors?.length ? <StarterSkillErrors {...c} /> : null}
      <Accordion
        value={c.startersOpen ? ['starter'] : []}
        onValueChange={(value) => c.setStartersOpen(value.includes('starter'))}
      >
        <AccordionItem value="starter">
          <AccordionTrigger className="skills-starters-trigger">
            <span>
              Starter skills <span className="ui-count">{baseSkills.length}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="skills-starter-list">
              {starters.map((item) => (
                <li className="skills-starter" key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <p title={item.note ? `${item.description} ${item.note}` : item.description}>
                      {item.description}
                    </p>
                  </div>
                  <Button
                    className="button small"
                    aria-label={`${item.sourceType === 'bundled' ? 'Add' : 'Import'} ${item.name}`}
                    disabled={c.working}
                    onClick={() => c.setEditing('import', item)}
                  >
                    {item.sourceType === 'bundled' ? 'Add' : 'Import'}
                  </Button>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
};
