import { CreateRole } from './components/CreateRole.tsx';
import { CrewUpdates } from './components/CrewUpdates.tsx';
import { CrewUpdateReview } from './components/CrewUpdateReview.tsx';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { CrewCard } from '@/CrewPage/components/CrewCard.tsx';
import { pendingInstructionUpdates } from '@/lib/instruction-updates.ts';
import { getRoleStatus } from '@/lib/role-status.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { Role } from '@pitchcrew/core';
import { useShallow } from 'zustand/react/shallow';

export const CrewPage = () => {
  const navigate = useNavigate({ from: '/crew' });
  const { updates: updatesOnly } = useSearch({ from: '/crew' });
  const { data, working, setRoleId, act, action } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
      working: state.working,
      setRoleId: state.setRoleId,
      act: state.act,
      action: state.action,
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
  const pendingIds = new Set(updates.map((update) => update.roleId));
  const roles = data.roles
    .filter((role) => !updatesOnly || pendingIds.has(role.id))
    .toSorted((a, b) => Number(pendingIds.has(b.id)) - Number(pendingIds.has(a.id)));
  return (
    <>
      <CreateRole data={data} working={working} />
      <CrewUpdates
        data={data}
        onReview={(id) => void navigate({ search: (previous) => ({ ...previous, review: id }) })}
      />
      <CrewUpdateReview data={data} action={action} working={working} />
      <div className="crew-grid">
        {roles.map((role) => (
          <CrewCard
            key={role.id}
            role={role}
            status={roleStatus(role)}
            update={updates.find((update) => update.roleId === role.id)}
            onConfigure={() => setRoleId(role.id)}
            onChat={() => openChat(role.id)}
            working={working}
            onRestore={() =>
              act(`/roles/${role.id}/restore`, 'POST', {}, `${role.name} restored paused`)
            }
          />
        ))}
      </div>
    </>
  );
};
