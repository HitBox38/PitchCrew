import { AppContextMenu } from '@/AppContextMenu/index.tsx';
import { RuntimeMaintenance } from '@/RuntimeMaintenance/index.tsx';
import { WorkspacePage } from '@/App/components/WorkspacePage.tsx';
import { WorkspaceNotification } from '@/App/components/WorkspaceNotification.tsx';
import { WorkspacePalette } from '@/App/components/WorkspacePalette.tsx';
import { WorkspacePanels } from '@/App/components/WorkspacePanels.tsx';
import { WorkspaceSidebar } from '@/App/components/WorkspaceSidebar.tsx';
import { WorkspaceToolbar } from '@/App/components/WorkspaceToolbar.tsx';
import { getWorkspaceModel } from '@/App/helpers.tsx';
import { SidebarInset } from '@/components/ui/sidebar/components/SidebarInset.tsx';
import { SidebarProvider } from '@/components/ui/sidebar/components/SidebarProvider.tsx';
import { useAutomaticUpdates } from '@/AppUpdates/hooks/useAutomaticUpdates.ts';
import { AgentUpdates } from '@/AgentUpdates/index.tsx';
import type { ReadyWorkspaceProps } from '../types.ts';

export const Workspace = (props: ReadyWorkspaceProps) => {
  useAutomaticUpdates();
  const controller = getWorkspaceModel(props);
  const { sidebarOpen, paletteMounted } = controller;
  return (
    <AppContextMenu {...controller}>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AgentUpdates />
        <RuntimeMaintenance />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <WorkspaceSidebar {...controller} />
        <SidebarInset id="main" tabIndex={-1}>
          <WorkspaceToolbar {...controller} />
          <WorkspacePage {...controller} />
        </SidebarInset>
        {paletteMounted ? <WorkspacePalette {...controller} /> : null}
        <WorkspaceNotification {...controller} />
        <WorkspacePanels {...controller} />
      </SidebarProvider>
    </AppContextMenu>
  );
};
