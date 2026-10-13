import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { StarterSkillsProps } from '@/SkillsView/types.ts';
import { baseSkills } from '@pitchcrew/core/base-skills';

export function StarterSkills({
  data,
  query,
  working,
  setStarter,
  setEditing,
}: StarterSkillsProps) {
  return (
    <Accordion className="starter-skills" defaultValue={data.skills.length ? [] : ['starter']}>
      <AccordionItem value="starter">
        <AccordionTrigger>
          <span>Starter skills</span>{' '}
          <span className="starter-skill-count">
            {baseSkills.length}
            <span className="sr-only"> suggestions</span>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <p className="quiet">
            These skills are loaded when your workspace starts. You can edit or remove them above,
            or import a starter again after removing it.
          </p>
          <ul className="starter-skill-library">
            {baseSkills
              .filter((item) =>
                `${item.name} ${item.description} ${item.source}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((item) => (
                <li className="starter-skill" key={item.name}>
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <span className="quiet skill-source">Made by {item.source.split('/')[0]}</span>
                    <br />
                    <span className="quiet skill-source">{item.source}</span>
                    {item.note ? <p className="quiet">{item.note}</p> : null}
                  </div>
                  <Button
                    className="button small"
                    aria-label={`${item.sourceType === 'bundled' ? 'Add' : 'Import'} ${item.name}`}
                    disabled={working}
                    onClick={() => {
                      setStarter(item);
                      setEditing('import');
                    }}
                  >
                    {item.sourceType === 'bundled' ? 'Add' : 'Import'}
                  </Button>
                </li>
              ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
