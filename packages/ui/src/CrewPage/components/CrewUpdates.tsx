import { useNavigate, useSearch } from '@tanstack/react-router';
import type { RoleId, Snapshot } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';

export const CrewUpdates = ({
  data,
  onReview,
}: {
  data: Snapshot;
  onReview: (id: RoleId) => void;
}) => {
  const { updates } = useSearch({ from: '/crew' });
  const navigate = useNavigate({ from: '/crew' });
  const available = (data.instructionUpdates ?? []).filter((update) =>
    data.roles.some((role) => role.id === update.roleId && !role.retiredAt),
  );
  return (
    <section className="mb-4 flex flex-col gap-2" aria-label="Instruction updates">
      <div className="flex flex-wrap items-center gap-3">
        <h2>Updates</h2>
        {available.length || updates ? (
          <Button
            className="button small"
            aria-pressed={Boolean(updates)}
            onClick={() =>
              void navigate({
                search: (previous) => ({ ...previous, updates: updates ? undefined : true }),
              })
            }
          >
            Updates only
          </Button>
        ) : null}
      </div>
      {available.length ? (
        <ul className="flex flex-col gap-2">
          {available.map((update) => (
            <li key={update.roleId} className="flex flex-wrap items-center gap-3">
              <span>
                {data.roles.find((role) => role.id === update.roleId)?.name} ·{' '}
                {update.dismissed ? 'Dismissed version' : 'Instructions update available'}
              </span>
              <Button className="button small" onClick={() => onReview(update.roleId)}>
                Review update
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="quiet text-sm">No instruction updates available.</p>
      )}
    </section>
  );
};
