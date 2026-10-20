import { Suspense } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { RoleSettings } from '@/App/constants.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { Snapshot } from '@pitchcrew/core';

export const CrewUpdateReview = ({
  data,
  action,
  working,
}: {
  data: Snapshot;
  action: Action;
  working: boolean;
}) => {
  const { review } = useSearch({ from: '/crew' });
  const navigate = useNavigate({ from: '/crew' });
  const role = data.roles.find((item) => item.id === review && !item.retiredAt);
  if (!role) return null;
  return (
    <Suspense fallback={null}>
      <RoleSettings
        key={role.id}
        reviewInstructions
        role={role}
        data={data}
        action={action}
        working={working}
        onClose={() =>
          void navigate({
            search: (previous) => ({ ...previous, review: undefined }),
            replace: true,
          })
        }
        onManageSkills={() => void navigate({ to: '/skills', search: { filter: role.id } })}
      />
    </Suspense>
  );
};
