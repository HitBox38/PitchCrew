import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import { skillSize } from '../helpers.ts';
import type { StepProps } from '../types.ts';

export function SkillsStep({ draft, changeDraft, data }: StepProps) {
  const skills = data.skills.filter((skill) => !skill.deletedAt);
  return (
    <div className="flex flex-col gap-5">
      <p className="quiet">
        Skills add reusable instructions. Shared skills apply automatically. Assign any other saved
        skills to this agent; their existing assignments stay in place.
      </p>
      <p className="quiet" aria-live="polite">
        {skillSize(draft, data).toLocaleString()} / 60,000 characters assigned
      </p>
      {!skills.length ? (
        <p>No saved skills yet. You can create this agent now and add skills on the Skills page.</p>
      ) : null}
      {skills.map((skill) => {
        const selected = draft.skills.find((reference) => reference.id === skill.id);
        const shared = skill.scope === 'all';
        return (
          <section key={skill.id} className="border-b border-border pb-4">
            <label className="flex items-start gap-3" aria-label={skill.name}>
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
              <span className="flex min-w-0 flex-col gap-1">
                <span>
                  {skill.name}
                  {shared ? ' · All agents' : ''}
                </span>
                <span className="quiet font-normal">{skill.description}</span>
              </span>
            </label>
            <details className="mt-3 ml-7">
              <summary className="cursor-pointer text-sm">Read instructions</summary>
              <pre className="mt-3 max-h-64 overflow-auto text-sm break-words whitespace-pre-wrap">
                {skill.content}
              </pre>
            </details>
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
      <p className="quiet">
        Skills do not grant tool access. You can import or write additional skills after creating
        the agent.
      </p>
    </div>
  );
}
