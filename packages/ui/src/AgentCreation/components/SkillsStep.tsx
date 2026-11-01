import { AccordionSection } from '@pitchcrew/design-system/accordion';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { Checkbox } from '@pitchcrew/design-system/checkbox';
import { skillSize } from '../helpers.ts';
import type { StepProps } from '../types.ts';

export const SkillsStep = ({ draft, changeDraft, data }: StepProps) => {
  const skills = data.skills.filter((skill) => !skill.deletedAt);
  return (
    <div className="agent-wizard-step">
      <p className="optional" aria-live="polite">
        {skillSize(draft, data).toLocaleString()} / 60,000 characters assigned
      </p>
      {!skills.length ? (
        <p>No saved skills yet. You can create this agent now and add skills on the Skills page.</p>
      ) : null}
      {skills.map((skill) => {
        const selected = draft.skills.find((reference) => reference.id === skill.id);
        const shared = skill.scope === 'all';
        return (
          <section key={skill.id} className="agent-wizard-skill">
            <label className="agent-wizard-skill-choice" aria-label={skill.name}>
              <Checkbox
                aria-label={skill.name}
                disabled={shared}
                checked={shared || Boolean(selected)}
                onCheckedChange={(checked) =>
                  changeDraft({
                    skills: checked
                      ? [...draft.skills, { id: skill.id, updatedAt: skill.updatedAt }]
                      : draft.skills.filter((reference) => reference.id !== skill.id),
                  })
                }
              />
              <span className="agent-tool-copy">
                <span className="agent-wizard-skill-name">
                  {skill.name}
                  {shared ? <span className="ui-chip">All agents</span> : null}
                </span>
                <span className="optional">{skill.description}</span>
              </span>
            </label>
            <AccordionSection
              className="agent-wizard-skill-text"
              triggerClassName="agent-wizard-skill-trigger"
              heading="Read instructions"
            >
              <SourceBlock label={skill.name} value={skill.content} contentClassName="max-h-64" />
            </AccordionSection>
            {selected && selected.updatedAt !== skill.updatedAt ? (
              <p className="form-error" role="alert">
                This skill changed. Deselect it, review the instructions, then select it again.
              </p>
            ) : null}
          </section>
        );
      })}
      {draft.skills
        .filter((reference) => !skills.some((skill) => skill.id === reference.id))
        .map((reference) => (
          <label key={reference.id} className="checkbox-label">
            <Checkbox
              aria-label="Removed skill — deselect to continue"
              checked
              onCheckedChange={() =>
                changeDraft({ skills: draft.skills.filter((skill) => skill.id !== reference.id) })
              }
            />
            Removed skill — deselect to continue
          </label>
        ))}
      <p className="optional">Shared skills apply automatically. Skills never grant tools.</p>
    </div>
  );
};
