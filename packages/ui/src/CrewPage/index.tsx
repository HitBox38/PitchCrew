import { useNavigate, useSearch } from '@tanstack/react-router';
import type { Role } from '@pitchcrew/core';
import { useShallow } from 'zustand/react/shallow';
import { useNow } from '@/ClayInterface/hooks/useNow.ts';
import { CrewCard } from '@/CrewPage/components/CrewCard.tsx';
import { crewRoster, crewStatus, roleToggleBody } from '@/CrewPage/helpers.ts';
import { pendingInstructionUpdates } from '@/lib/instruction-updates.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { CrewDismissed } from './components/CrewDismissed.tsx';
import { CrewRetired } from './components/CrewRetired.tsx';
import { CrewTitleActions } from './components/CrewTitleActions.tsx';
import { CrewUpdateReview } from './components/CrewUpdateReview.tsx';
import { CrewWaiting } from './components/CrewWaiting.tsx';

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
  const now = useNow();
  if (!data) return null;
  const review = (id: string) =>
    void navigate({ search: (previous) => ({ ...previous, review: id }) });
  const toggle = (role: Role) =>
    act(
      `/roles/${role.id}`,
      'PUT',
      roleToggleBody(role),
      `${role.name} ${role.enabled ? 'paused' : 'resumed'}`,
    );
  const updates = pendingInstructionUpdates(data);
  const pendingIds = new Set(updates.map((update) => update.roleId));
  const roles = crewRoster(data.roles).filter((role) => !updatesOnly || pendingIds.has(role.id));
  return (
    <div className="crew-page">
      <CrewTitleActions data={data} working={working} />
      <CrewUpdateReview data={data} action={action} working={working} />
      {roles.length ? (
        <div className="crew-grid">
          {roles.map((role) => (
            <CrewCard
              key={role.id}
              role={role}
              status={crewStatus(role, data, now)}
              update={updates.find((update) => update.roleId === role.id)}
              now={now}
              working={working}
              onConfigure={() => setRoleId(role.id)}
              onChat={() => void openChat(role.id)}
              onToggle={() => toggle(role)}
              onReview={() => review(role.id)}
            />
          ))}
        </div>
      ) : (
        <p className="ui-empty">
          {updatesOnly ? 'No agents have new default instructions.' : 'No agents yet.'}
        </p>
      )}
      <CrewWaiting data={data} updates={updates} onReview={review} />
      <CrewDismissed data={data} onReview={review} />
      <CrewRetired roles={data.roles.filter((role) => role.retiredAt)} />
    </div>
  );
};
