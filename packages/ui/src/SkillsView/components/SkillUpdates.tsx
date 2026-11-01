import { Button } from '@pitchcrew/design-system/button';
import { availableSkillUpdates } from '@/lib/skill-updates.ts';
import { Link } from '@tanstack/react-router';
import type { SkillsViewModel } from '../types.ts';
import { SkillCheckButton } from '@/AgentUpdates/components/SkillCheckButton.tsx';
import { latestSuccessfulCheck } from '../helpers.ts';

/** Updates group at the top of the library, or one quiet line when nothing is known. */
export const SkillUpdates = ({
  data,
  pending,
  compact,
}: SkillsViewModel & { compact?: boolean }) => {
  const available = availableSkillUpdates(data).toSorted(
    (a, b) => Number(pending.has(b.skillId)) - Number(pending.has(a.skillId)),
  );
  const checks = data.skillUpdates?.checks ?? [];
  const successful = latestSuccessfulCheck(checks);
  const checked = successful
    ? `Last successful check ${new Date(successful).toLocaleString()}.`
    : 'No successful update checks yet.';
  if (compact)
    return (
      <section className="skills-updates-line" aria-label="Skill updates">
        <p>
          No known updates. <span>{checked}</span>
        </p>
        <SkillCheckButton />
      </section>
    );
  const failed = checks.filter((check) => check.error);
  const name = (id: string) => data.skills.find((skill) => skill.id === id)?.name;
  return (
    <section className="skills-updates" aria-labelledby="skills-updates-heading">
      <div className="skills-updates-head">
        <h2 id="skills-updates-heading">
          Updates <span className="ui-count">{pending.size}</span>
        </h2>
        <SkillCheckButton />
      </div>
      {available.length ? (
        <ul>
          {available.map((check) => (
            <li key={check.skillId} className="skills-update-row">
              <span className="skills-update-copy">
                <strong>{name(check.skillId)}</strong>
                <span data-pending={pending.has(check.skillId) || undefined}>
                  {pending.has(check.skillId) ? 'Update available' : 'Dismissed version'}
                </span>
              </span>
              <Button
                className="button small"
                aria-label={`Review ${name(check.skillId)} update`}
                nativeButton={false}
                render={<Link to="/skills" search={{ skill: check.skillId, review: true }} />}
              >
                Review
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {failed.length ? (
        <p className="skills-updates-error">
          Couldn’t check: {failed.map((check) => name(check.skillId)).join(', ')}. Try Check now.
        </p>
      ) : null}
      <p className="skills-updates-meta">{checked}</p>
    </section>
  );
};
