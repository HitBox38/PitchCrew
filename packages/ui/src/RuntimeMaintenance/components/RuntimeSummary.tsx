import type { RuntimeInfo, RuntimeMaintenanceState, RuntimeUpdateInfo } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { runtimeStatus, signInStatus } from '../helpers.ts';

/** Meaningful update and sign-in facts, plus the agents using this installation. */
export const RuntimeSummary = ({
  runtime,
  update,
  authentication,
}: {
  runtime: RuntimeInfo;
  update?: RuntimeUpdateInfo;
  authentication: RuntimeMaintenanceState['authentication'];
}) => {
  const roles = useWorkspaceStore((state) => state.data?.roles);
  const users = roles?.filter((role) => !role.retiredAt && role.runtime === runtime.id) ?? [];
  const facts = [runtimeStatus(runtime, update), signInStatus(runtime, authentication)].filter(
    (fact): fact is NonNullable<typeof fact> => fact !== null && fact.label !== 'Compatible',
  );
  return (
    <div className="settings-runtime-facts">
      {facts.map((fact) => (
        <span
          key={fact.label}
          className={fact.label === 'Sign-in not checked' ? 'ui-row-meta' : 'ui-chip'}
          data-tone={fact.tone || undefined}
        >
          {fact.label}
        </span>
      ))}
      {users.length ? (
        <span className="settings-runtime-users">
          <span className="settings-pebbles" aria-hidden="true">
            {users.slice(0, 4).map((role) => (
              <RoleAvatar key={role.id} agentRole={role.id} size="small" />
            ))}
          </span>
          <span className="ui-row-meta wrap-anywhere">
            Used by {users.map((role) => role.name).join(', ')}
          </span>
        </span>
      ) : null}
    </div>
  );
};
