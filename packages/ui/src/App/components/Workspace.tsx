import { WorkspaceHeading } from '@/App/components/WorkspaceHeading.tsx';
import { WorkspaceNotification } from '@/App/components/WorkspaceNotification.tsx';
import { WorkspacePalette } from '@/App/components/WorkspacePalette.tsx';
import { WorkspacePanels } from '@/App/components/WorkspacePanels.tsx';
import { WorkspaceSidebar } from '@/App/components/WorkspaceSidebar.tsx';
import { WorkspaceToolbar } from '@/App/components/WorkspaceToolbar.tsx';
import { getWorkspaceModel } from '@/App/helpers.tsx';
import { SidebarInset } from '@/components/ui/sidebar/components/SidebarInset.tsx';
import { SidebarProvider } from '@/components/ui/sidebar/components/SidebarProvider.tsx';
import { Outlet } from '@tanstack/react-router';
import { Onboarding } from '@/Onboarding/index.tsx';
import { AppUpdates } from '@/AppUpdates/index.tsx';
import { Suspense } from 'react';
import type { ReadyWorkspaceProps } from '../types.ts';

export function Workspace(props: ReadyWorkspaceProps) {
  const controller = getWorkspaceModel(props);
  const { error, view, sidebarOpen, paletteMounted } = controller;
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <WorkspaceSidebar {...controller} />
      <SidebarInset id="main" tabIndex={-1}>
        <WorkspaceToolbar {...controller} />
        <div className={`page ${view === 'chat' ? 'chat-page' : ''}`}>
          <WorkspaceHeading {...controller} />
          <Onboarding />
          <AppUpdates />
          {error ? (
            <div role="alert" className="error-banner">
              Lost connection to the local daemon: {error}
            </div>
          ) : null}
          <Suspense fallback={<p className="quiet">Opening view…</p>}>
            <Outlet />
          </Suspense>
        </div>
      </SidebarInset>
      {paletteMounted ? <WorkspacePalette {...controller} /> : null}
      <WorkspaceNotification {...controller} />
      <WorkspacePanels {...controller} />
    </SidebarProvider>
  );
}
