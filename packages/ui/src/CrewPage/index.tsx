import { CrewCard } from '@/CrewPage/components/CrewCard.tsx';
import { ConnectorSettings } from '@/CrewPage/constants.ts';
import { runtimeLabels } from '@/lib/labels.ts';
import { getRoleStatus } from '@/lib/role-status.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { Role } from '@pitchcrew/core';
import { Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';

export function CrewPage() {
  const { data, action, working, setRoleId } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
      action: state.action,
      working: state.working,
      setRoleId: state.setRoleId,
    })),
  );
  const { openChat } = useWorkspaceNavigation();
  if (!data) return null;
  const roleStatus = (role: Role) => getRoleStatus(role, data);
  return (
    <>
      <div className="crew-grid">
        {data.roles.map((role) => (
          <CrewCard
            key={role.id}
            role={role}
            status={roleStatus(role)}
            onConfigure={() => setRoleId(role.id)}
            onChat={() => openChat(role.id)}
          />
        ))}
      </div>
      <Suspense fallback={<p className="quiet">Loading connectors…</p>}>
        <ConnectorSettings data={data} action={action} working={working} />
      </Suspense>
      <h2 className="subheading">Runtimes on this machine</h2>
      <div className="runtime-list">
        {data.runtimes.map((runtime) => (
          <div className="runtime-row" key={runtime.id}>
            <div>
              <strong>{runtimeLabels[runtime.id]}</strong>
              <p>{runtime.detail}</p>
            </div>
            {runtime.version ? <small>{runtime.version}</small> : null}
            <span className={`badge ${runtime.available ? 'success' : ''}`}>
              {runtime.available ? 'Available' : 'Unavailable'}
            </span>
          </div>
        ))}
      </div>
      <p className="info-note">
        Demo makes deterministic drafts without calling a model. Other runtimes use their native
        authentication for conversations and job workflows.
      </p>
    </>
  );
}
