import { createContext, Suspense, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Outlet } from '@tanstack/react-router';
import { Onboarding } from '@/Onboarding/index.tsx';
import { WorkspaceHeading } from './WorkspaceHeading.tsx';
import type { WorkspaceModel } from '../types.ts';
import { StartupReady } from '@/Analytics/components/StartupReady.tsx';

const HeaderActions = createContext<HTMLDivElement | null>(null);

export function WorkspaceHeaderActions({ children }: { children: ReactNode }) {
  const target = useContext(HeaderActions);
  return target ? createPortal(children, target) : null;
}

export function WorkspacePage(controller: WorkspaceModel) {
  const { view, error } = controller;
  const [actions, setActions] = useState<HTMLDivElement | null>(null);
  const dedicated = view === 'chat' || view === 'profile';
  const notices = (
    <>
      <Onboarding />
      {error ? (
        <div role="alert" className="error-banner">
          Lost connection to the local daemon: {error}
        </div>
      ) : null}
    </>
  );
  const content = (
    <Suspense fallback={<p className="quiet workspace-loading">Opening view…</p>}>
      <Outlet />
      <StartupReady />
    </Suspense>
  );
  return (
    <HeaderActions.Provider value={actions}>
      <div className={`page ${dedicated ? `${view}-page` : 'workspace-page'}`}>
        {dedicated ? (
          <>
            {notices}
            {content}
          </>
        ) : (
          <section className="workspace-frame" aria-label={`${view ?? 'Page'} workspace`}>
            <WorkspaceHeading {...controller} actionsRef={setActions} />
            <div className={`workspace-body ${view ?? 'not-found'}-workspace-body`}>
              {notices}
              {content}
            </div>
          </section>
        )}
      </div>
    </HeaderActions.Provider>
  );
}
