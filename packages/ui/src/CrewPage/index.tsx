import { CreateRole } from './components/CreateRole.tsx';
import { CrewCard } from '@/CrewPage/components/CrewCard.tsx';
import { ConnectorSettings } from '@/CrewPage/constants.ts';
import { RuntimeList } from '@/CrewPage/components/RuntimeList.tsx';
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
  const roleStatus = (role: Role) => {
    if (role.retiredAt) return 'Retired';
    if (!role.enabled) return 'Paused';
    if (!data.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available))
      return 'Unavailable';
    const status = getRoleStatus(role, data);
    return status.startsWith('Working') ? status : 'Ready';
  };
  return (
    <>
      <CreateRole data={data} working={working} />
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
      <RuntimeList runtimes={data.runtimes} />
    </>
  );
}
