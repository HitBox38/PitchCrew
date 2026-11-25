import type { WorkspaceSidebarProps } from '@/App/types.ts';
import { ClaySidebar } from '@/ClayInterface/components/ClaySidebar.tsx';
import { sidebarCounts } from '@/AppSidebar/helpers.ts';

export const WorkspaceSidebar = ({
  view,
  attention,
  data,
  openCard,
  recentCards,
  toggleRole,
  setRoleId,
  working,
}: WorkspaceSidebarProps) => (
  <ClaySidebar
    data={data}
    view={view}
    counts={sidebarCounts(attention)}
    recent={recentCards}
    working={working}
    onOpenCard={openCard}
    onConfigureRole={setRoleId}
    onToggleRole={toggleRole}
  />
);
