import type { CSSProperties } from 'react';
import { AppContextMenu } from '@/AppContextMenu/index.tsx';
import { RuntimeMaintenance } from '@/RuntimeMaintenance/index.tsx';
import { WorkspacePage } from '@/App/components/WorkspacePage.tsx';
import { WorkspaceNotification } from '@/App/components/WorkspaceNotification.tsx';
import { WorkspacePalette } from '@/App/components/WorkspacePalette.tsx';
import { WorkspacePanels } from '@/App/components/WorkspacePanels.tsx';
import { WorkspaceSidebar } from '@/App/components/WorkspaceSidebar.tsx';
import { WorkspaceAppBar } from './WorkspaceAppBar.tsx';
import { ShellShortcuts } from '@/App/components/ShellShortcuts.tsx';
import { getWorkspaceModel } from '@/App/helpers.tsx';
import { SidebarInset, SidebarProvider } from '@pitchcrew/design-system/sidebar';
import { useAutomaticUpdates } from '@/AppUpdates/hooks/useAutomaticUpdates.ts';
import { AgentUpdates } from '@/AgentUpdates/index.tsx';
import { DesktopBrowserHost } from '@/DesktopBrowserHost/index.tsx';
import { NotificationCenter } from '@/Notifications/index.tsx';
import type { ReadyWorkspaceProps } from '../types.ts';
import { useShortCoarseChatRail } from '../hooks/useShortCoarseChatRail.ts';
import { useBrowserRail } from '../hooks/useBrowserRail.ts';

/** The sidebar shares the paper: 276 wide, a 56 rail when collapsed. */
const shellWidths = { '--sidebar-width': '276px', '--sidebar-width-icon': '56px' } as CSSProperties;

export const Workspace = (props: ReadyWorkspaceProps) => {
  useAutomaticUpdates();
  const controller = getWorkspaceModel(props);
  const { sidebarOpen, paletteMounted } = controller;
  const shortCoarse = useShortCoarseChatRail(controller.view);
  const browserRail = useBrowserRail(controller.view);
  const preferRail = shortCoarse || browserRail;
  return (
    <AppContextMenu {...controller}>
      <SidebarProvider defaultOpen={sidebarOpen} preferRail={preferRail} style={shellWidths}>
        <DesktopBrowserHost>
          <AgentUpdates />
          <RuntimeMaintenance />
          <ShellShortcuts go={controller.go} />
          <WorkspaceAppBar
            data={controller.data}
            settingsActive={controller.view === 'settings'}
            onSearch={() => controller.setPaletteOpen(true)}
            onAddJob={() => controller.setAdd(true)}
          />
          <WorkspaceSidebar {...controller} />
          <SidebarInset id="main" tabIndex={-1} className="workspace-main">
            <WorkspacePage {...controller} />
          </SidebarInset>
          {paletteMounted ? <WorkspacePalette {...controller} /> : null}
          <WorkspaceNotification {...controller} />
          <NotificationCenter />
          <WorkspacePanels {...controller} />
        </DesktopBrowserHost>
      </SidebarProvider>
    </AppContextMenu>
  );
};
