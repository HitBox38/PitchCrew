import type { WorkspaceSidebarProps } from '@/App/types.ts';
import { AppSidebar } from '@/AppSidebar/index.tsx';

export function WorkspaceSidebar({
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
}: WorkspaceSidebarProps) {
  return (
    <AppSidebar
      view={view}
      stages={stageLinks}
      onStage={jumpToStage}
      counts={{ inbox: pending, profile: data.profile.length }}
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
}
