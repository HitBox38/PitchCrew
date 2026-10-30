import type { WorkspaceSidebarProps } from '@/App/types.ts';
import { AppSidebar } from '@/AppSidebar/index.tsx';
import { ClaySidebar } from '@/ClayInterface/components/ClaySidebar.tsx';
import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { pendingInstructionUpdates } from '@/lib/instruction-updates.ts';
import { pendingSkillUpdates } from '@/lib/skill-updates.ts';

export const WorkspaceSidebar = ({
  view,
  stageLinks,
  jumpToStage,
  pending,
  data,
  roleStatus,
  running,
  setRoleId,
  openChat,
  toggleRole,
  recentCards,
  openCard,
  setPaletteOpen,
  setAdd,
  working,
}: WorkspaceSidebarProps) => {
  const clay = useDevicePreferences((state) => state.clayInterface);
  const Sidebar = clay ? ClaySidebar : AppSidebar;
  return (
    <Sidebar
      data={data}
      view={view}
      stages={stageLinks}
      onStage={jumpToStage}
      counts={{
        queue:
          data.queue?.queues.reduce(
            (count, q) =>
              count +
              q.requests.filter((r) =>
                r.deliveries.some((d) =>
                  ['queued', 'paused', 'failed', 'waiting'].includes(d.status),
                ),
              ).length,
            0,
          ) ?? 0,
        inbox: pending,
        profile: data.profile.length,
        crew: pendingInstructionUpdates(data).length,
        skills: pendingSkillUpdates(data).length,
      }}
      roles={data.roles}
      roleStatus={roleStatus}
      runningRoles={running.map((r) => r.roleId)}
      onConfigureRole={setRoleId}
      onChatRole={openChat}
      onToggleRole={toggleRole}
      recent={recentCards}
      onOpenCard={openCard}
      onSearch={() => setPaletteOpen(true)}
      onAddJob={() => setAdd(true)}
      working={working}
    />
  );
};
