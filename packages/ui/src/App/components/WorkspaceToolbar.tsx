import { Notifications } from '@/Notifications/index.tsx';
import type { WorkspaceToolbarProps } from '@/App/types.ts';
import { SidebarTrigger } from '@/components/ui/sidebar/components/SidebarTrigger.tsx';
import { modKey } from '@/shortcuts.ts';
import { LoaderCircle } from 'lucide-react';

export function WorkspaceToolbar({ running, data }: WorkspaceToolbarProps) {
  return (
    <div className="page-toolbar">
      <SidebarTrigger title={`Toggle sidebar (${modKey}B)`} />
      {running.length ? (
        <output className="run-status">
          <LoaderCircle size={13} className="spin" />
          {running
            .map((run) => {
              const role = data.roles.find((r) => r.id === run.roleId);
              const card = data.cards.find((c) => c.id === run.cardId);
              return `${role?.name ?? run.roleId} ${run.mode === 'chat' ? 'is replying' : `on ${card?.company ?? 'a job'}`}`;
            })
            .join(', ')}
        </output>
      ) : null}
      <Notifications />
    </div>
  );
}
