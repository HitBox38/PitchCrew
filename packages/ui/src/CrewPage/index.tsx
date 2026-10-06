import { CreateRole } from './components/CreateRole.tsx';
import { InstructionUpdatesNotice } from './components/InstructionUpdatesNotice.tsx';
import { CrewCard } from '@/CrewPage/components/CrewCard.tsx';
import { pendingInstructionUpdates } from '@/lib/instruction-updates.ts';
import { getRoleStatus } from '@/lib/role-status.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { Role } from '@pitchcrew/core';
import { useShallow } from 'zustand/react/shallow';

export function CrewPage() {
  const { data, working, setRoleId } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
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
  const updates = pendingInstructionUpdates(data);
  return (
    <>
      <CreateRole data={data} working={working} />
      <InstructionUpdatesNotice data={data} onReview={setRoleId} />
      <div className="crew-grid">
        {data.roles.map((role) => (
          <CrewCard
            key={role.id}
            role={role}
            status={roleStatus(role)}
            update={updates.find((update) => update.roleId === role.id)}
            onConfigure={() => setRoleId(role.id)}
            onChat={() => openChat(role.id)}
          />
        ))}
      </div>
    </>
  );
}
