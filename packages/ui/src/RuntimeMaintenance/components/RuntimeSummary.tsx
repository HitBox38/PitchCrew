import type { RuntimeInfo, RuntimeMaintenanceState, RuntimeUpdateInfo } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { runtimeStatus } from '../helpers.ts';

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
  const names = roles
    ?.filter((role) => !role.retiredAt && role.runtime === runtime.id)
    .map((role) => role.name);
  const status = runtimeStatus(runtime, update);
  const missing = authentication.some((entry) => entry.result.status === 'missing');
  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`badge ${status.tone}`}>{status.label}</span>
        {missing ? <span className="runtime-auth-needed">Sign-in needed</span> : null}
      </div>
      {names?.length ? <p className="quiet wrap-anywhere">Used by {names.join(', ')}</p> : null}
    </div>
  );
};
