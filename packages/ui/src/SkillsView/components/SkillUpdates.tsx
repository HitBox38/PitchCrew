import { Button } from '@/components/ui/button/components/Button.tsx';
import { availableSkillUpdates, pendingSkillUpdates } from '@/lib/skill-updates.ts';
import { Link } from '@tanstack/react-router';
import type { SkillsViewModel } from '../types.ts';
import { SkillCheckButton } from '@/AgentUpdates/components/SkillCheckButton.tsx';

export const SkillUpdates = ({
  data,
  updatesOnly,
  onUpdatesOnly,
}: Pick<SkillsViewModel, 'data' | 'updatesOnly' | 'onUpdatesOnly'>) => {
  const available = availableSkillUpdates(data);
  const pending = new Set(pendingSkillUpdates(data).map((check) => check.skillId));
  const checks = data.skillUpdates?.checks ?? [];
  const successful = checks
    .map((check) => check.successfulAt)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
  const failed = checks.filter((check) => check.error);
  return (
    <section className="flex flex-col gap-2" aria-label="Skill updates">
      <div className="flex flex-wrap items-center gap-3">
        <h2>Updates</h2>
        {available.length || updatesOnly ? (
          <Button className="button small" aria-pressed={updatesOnly} onClick={onUpdatesOnly}>
            Updates only
          </Button>
        ) : null}
        <span className="quiet text-sm">
          {pending.size} pending · {available.length - pending.size} dismissed
        </span>
        <SkillCheckButton />
      </div>
      {available.length ? (
        <div className="flex max-h-36 flex-col gap-2 overflow-y-auto">
          {available
            .toSorted((a, b) => Number(pending.has(b.skillId)) - Number(pending.has(a.skillId)))
            .map((check) => (
              <div key={check.skillId} className="flex flex-wrap items-center gap-3">
                <span className="text-sm">
                  {data.skills.find((skill) => skill.id === check.skillId)?.name} ·{' '}
                  {pending.has(check.skillId) ? 'Update available' : 'Dismissed version'}
                </span>
                <Button
                  className="button small"
                  nativeButton={false}
                  render={<Link to="/skills" search={{ skill: check.skillId, review: true }} />}
                >
                  Review update
                </Button>
              </div>
            ))}
        </div>
      ) : (
        <p className="quiet text-sm">No known upstream updates.</p>
      )}
      {failed.length ? (
        <p className="quiet text-sm">
          Couldn’t check:{' '}
          {failed
            .map((check) => data.skills.find((skill) => skill.id === check.skillId)?.name)
            .join(', ')}
          . Try Check now.
        </p>
      ) : null}
      <p className="quiet text-sm">
        {successful
          ? `Last successful check ${new Date(successful).toLocaleString()}.`
          : 'No successful update checks yet.'}
      </p>
    </section>
  );
};
