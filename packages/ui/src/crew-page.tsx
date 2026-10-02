import { lazy, Suspense } from 'react';
import { MessageSquare, SlidersHorizontal } from 'lucide-react';
import type { Role } from '@pitchcrew/core';
import { Button } from './components/ui/button.tsx';
import { RoleAvatar, runtimeLabels } from './components.tsx';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from './workspace-store.ts';
import { useWorkspaceNavigation } from './workspace-navigation.ts';

const ConnectorSettings = lazy(() =>
  import('./connector-settings.tsx').then((m) => ({ default: m.ConnectorSettings })),
);

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
    if (!role.enabled) return 'Paused';
    const run = data.runs.find((run) => run.status === 'running' && run.roleId === role.id);
    if (!run) return runtimeLabels[role.runtime];
    const card = data.cards.find((card) => card.id === run.cardId);
    return card ? `Working on ${card.company}` : 'Working';
  };
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
function CrewCard({
  role,
  status,
  onConfigure,
  onChat,
}: {
  role: Role;
  status: string;
  onConfigure: () => void;
  onChat: () => void;
}) {
  return (
    <section className={`crew-card ${role.id}`}>
      <div className="crew-card-top">
        <RoleAvatar agentRole={role.id} size="large" />
        <div>
          <h2>{role.name}</h2>
          <span className={`role-status ${!role.enabled ? 'paused' : ''}`}>
            {role.enabled ? 'Enabled' : 'Paused'}
          </span>
        </div>
      </div>
      <p>{role.description}</p>
      <dl className="crew-runtime">
        <div>
          <dt>Runtime</dt>
          <dd>{runtimeLabels[role.runtime]}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{role.model || 'CLI default'}</dd>
        </div>
        <div>
          <dt>Now</dt>
          <dd>{status.startsWith('Working') ? status : 'Idle'}</dd>
        </div>
      </dl>
      <Button className="button primary" onClick={onChat}>
        <MessageSquare size={14} /> Chat
      </Button>
      <Button className="button" onClick={onConfigure}>
        <SlidersHorizontal size={14} /> Configure
      </Button>
    </section>
  );
}
