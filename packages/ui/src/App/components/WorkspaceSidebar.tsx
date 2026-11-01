import type { WorkspaceSidebarProps } from '@/App/types.ts';
import { ClaySidebar } from '@/ClayInterface/components/ClaySidebar.tsx';
import { sidebarCounts } from '@/AppSidebar/helpers.ts';

export const WorkspaceSidebar = ({
  view,
  pending,
  data,
  openCard,
  setPaletteOpen,
  setAdd,
  recentCards,
  toggleRole,
  setRoleId,
  working,
}: WorkspaceSidebarProps) => (
  <ClaySidebar
    data={data}
    view={view}
    counts={sidebarCounts(data, pending)}
    recent={recentCards}
    working={working}
    onOpenCard={openCard}
    onSearch={() => setPaletteOpen(true)}
    onAddJob={() => setAdd(true)}
    onConfigureRole={setRoleId}
    onToggleRole={toggleRole}
  />
);
