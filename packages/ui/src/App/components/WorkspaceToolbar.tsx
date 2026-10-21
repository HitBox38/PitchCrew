import { Notifications } from '@/Notifications/index.tsx';
import type { WorkspaceToolbarProps } from '@/App/types.ts';
import { SidebarTrigger } from '@/components/ui/sidebar/components/SidebarTrigger.tsx';
import { modKey } from '@/shortcuts.ts';
import { QueueWidget } from '@/QueueWidget/index.tsx';
import { SourceActivity } from '@/components/ProfileSources/components/SourceActivity.tsx';

export const WorkspaceToolbar = ({ data }: WorkspaceToolbarProps) => {
  return (
    <div className="page-toolbar">
      <SidebarTrigger title={`Toggle sidebar (${modKey}B)`} />
      <QueueWidget data={data} />
      <SourceActivity />
      <Notifications />
    </div>
  );
};
