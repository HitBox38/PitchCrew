import { Suspense, useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { Onboarding } from '@/Onboarding/index.tsx';
import { WorkspaceHeading } from './WorkspaceHeading.tsx';
import { WorkspaceMobileBar } from './WorkspaceMobileBar.tsx';
import { HeaderSlots } from './WorkspaceHeaderSlots.tsx';
import type { WorkspaceModel } from '../types.ts';
import { StartupReady } from '@/Analytics/components/StartupReady.tsx';

export {
  WorkspaceHeaderActions,
  WorkspaceHeaderFact,
  WorkspaceHeaderPrimary,
  WorkspaceHeaderSegment,
} from './WorkspaceHeaderSlots.tsx';

/**
 * The page on the paper: the phone top bar, a title row and one independently scrolling work
 * area. Chat and Profile keep their dedicated workspaces inside the same bounds.
 */
export const WorkspacePage = (controller: WorkspaceModel) => {
  const { view, error } = controller;
  const [fact, setFact] = useState<HTMLSpanElement | null>(null);
  const [segment, setSegment] = useState<HTMLDivElement | null>(null);
  const [actions, setActions] = useState<HTMLDivElement | null>(null);
  const [primary, setPrimary] = useState<HTMLDivElement | null>(null);
  const [mobilePrimary, setMobilePrimary] = useState<HTMLDivElement | null>(null);
  const [mobileTitle, setMobileTitle] = useState<HTMLDivElement | null>(null);
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
    <HeaderSlots.Provider
      value={{ fact, segment, actions, primary, mobilePrimary, mobileTitle, dedicated }}
    >
      <WorkspaceMobileBar
        title={controller.title}
        primaryRef={setMobilePrimary}
        titleRef={setMobileTitle}
        onSearch={() => controller.setPaletteOpen(true)}
        onAddJob={() => controller.setAdd(true)}
      />
      <div className={`page ${dedicated ? `${view}-page` : 'workspace-page'}`}>
        {dedicated ? (
          <>
            {notices}
            {content}
          </>
        ) : (
          <>
            <WorkspaceHeading
              {...controller}
              factRef={setFact}
              segmentRef={setSegment}
              actionsRef={setActions}
              primaryRef={setPrimary}
            />
            <div className={`workspace-body ${view ?? 'not-found'}-workspace-body`}>
              {notices}
              {content}
            </div>
          </>
        )}
      </div>
    </HeaderSlots.Provider>
  );
};
