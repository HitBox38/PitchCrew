import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useAppReducedMotion } from './motion.tsx';
import { Outlet, useMatches, useNavigate, useRouter } from '@tanstack/react-router';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from './workspace-store.ts';
import { useWorkspaceNavigation } from './workspace-navigation.ts';
import { closedStates, stages } from './board-stages.ts';
import { Button } from './components/ui/button.tsx';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Plus, RefreshCw, LoaderCircle, X } from 'lucide-react';
import type { Role } from '@pitchcrew/core';
import { Brand, runtimeLabels } from './components.tsx';
import { useTheme } from './theme.ts';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar.tsx';
import { AppSidebar, viewTitles } from './app-sidebar.tsx';
import { modKey, useShortcuts } from './shortcuts.ts';
// Views, dialogs and the command palette load on first use to keep the entry chunk small.
const views = () => import('./views.tsx');
const AddOpportunity = lazy(() => views().then((m) => ({ default: m.AddOpportunity })));
const CardDetails = lazy(() => views().then((m) => ({ default: m.CardDetails })));
const RoleSettings = lazy(() => views().then((m) => ({ default: m.RoleSettings })));
const CommandPalette = lazy(() =>
  import('./command-palette.tsx').then((m) => ({ default: m.CommandPalette })),
);
export function App() {
  const reduced = useAppReducedMotion();
  const {
    data,
    error,
    toast,
    working,
    add,
    selectedId,
    roleId,
    recentIds,
    reload,
    startSync,
    action,
    act,
    setToast,
    setAdd,
    setSelectedId,
    setRoleId,
    openCard,
    closePanels,
  } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
      error: state.error,
      toast: state.toast,
      working: state.working,
      add: state.add,
      selectedId: state.selectedId,
      roleId: state.roleId,
      recentIds: state.recentIds,
      reload: state.reload,
      startSync: state.startSync,
      action: state.action,
      act: state.act,
      setToast: state.setToast,
      setAdd: state.setAdd,
      setSelectedId: state.setSelectedId,
      setRoleId: state.setRoleId,
      openCard: state.openCard,
      closePanels: state.closePanels,
    })),
  );
  const { go, openChat } = useWorkspaceNavigation();
  useEffect(() => startSync(), [startSync]);
  const navigate = useNavigate();
  const router = useRouter();
  const view = useMatches({
    select: (matches) => matches.findLast((match) => match.staticData.view)?.staticData.view,
  });
  const [sidebarOpen] = useState(
    () => !document.cookie.split('; ').includes('sidebar_state=false'),
  );
  const [theme, setTheme] = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMounted, setPaletteMounted] = useState(false);
  if (paletteOpen && !paletteMounted) setPaletteMounted(true);
  useShortcuts({ search: () => setPaletteOpen(true), newJob: () => setAdd(true) });
  useEffect(
    () =>
      router.subscribe('onBeforeNavigate', ({ fromLocation, toLocation }) => {
        if (fromLocation?.href === toLocation.href) return;
        closePanels();
        setPaletteOpen(false);
      }),
    [router, closePanels],
  );
  const pending =
    (data?.approvals.filter((a) => a.status === 'pending').length ?? 0) +
    (data?.computerApprovals.filter((a) => a.status === 'pending').length ?? 0);
  const selected = data?.cards.find((c) => c.id === selectedId);
  const selectedRole = data?.roles.find((r) => r.id === roleId);
  const jumpToStage = (id: string) => {
    go('board');
    const { setShowClosed, setQuery, setFlashStage } = useWorkspaceStore.getState();
    setShowClosed(false);
    setQuery('');
    setFlashStage(id);
  };
  const copyDirectory = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.dataDirectory).then(
      () => setToast('Copied the data folder path'),
      () => setToast(`Data folder: ${data.dataDirectory}`),
    );
  };
  const checkRuntimes = () =>
    act('/runtimes/detect', 'POST', undefined, 'Checked installed runtimes');
  if (!data)
    return (
      <div className="boot">
        <Brand />
        <p>{error || 'Opening your local workspace…'}</p>
        {error ? (
          <Button className="button" onClick={() => void reload().catch(() => {})}>
            Try again
          </Button>
        ) : (
          <LoaderCircle className="spin" size={22} />
        )}
      </div>
    );
  const active = data.cards.filter((c) => !closedStates.includes(c.state));
  const strong = data.cards.filter((c) => c.fit !== null && c.fit >= 80).length;
  const running = data.runs.filter((r) => r.status === 'running');
  const roleStatus = (role: Role) => {
    if (!role.enabled) return 'Paused';
    const run = running.find((r) => r.roleId === role.id);
    if (!run) return runtimeLabels[role.runtime];
    const card = data.cards.find((c) => c.id === run.cardId);
    return card ? `Working on ${card.company}` : 'Working';
  };
  const summary =
    view === 'board' ? (
      data.cards.length ? (
        <>
          <strong>{active.length}</strong> active, <strong>{strong}</strong> with a strong fit
          {pending ? (
            <>
              , <strong>{pending}</strong> waiting on your approval
            </>
          ) : null}
          .
        </>
      ) : (
        'Nothing on the board yet.'
      )
    ) : view === 'crew' ? (
      'Configure how each role works, then start a conversation or a job workflow.'
    ) : view === 'chat' ? (
      'Talk with a role, follow crew exchanges, and shape how your agents work.'
    ) : view === 'inbox' ? (
      pending ? (
        <>
          <strong>{pending}</strong> {pending === 1 ? 'approval is' : 'approvals are'} waiting on
          you.
        </>
      ) : (
        'Nothing is waiting on you.'
      )
    ) : view === 'skills' ? (
      'Give the whole crew shared skills, or tailor them to individual agents.'
    ) : view === 'profile' ? (
      'Writer only quotes from these notes, and Reviewer checks every claim against them.'
    ) : view === 'activity' ? (
      `${data.events.length} events, newest first. The log is append-only.`
    ) : (
      'Check the address or return to Board.'
    );
  const stageLinks = stages.map((stage) => ({
    id: stage.id,
    label: stage.label,
    color: stage.color,
    count: data.cards.filter((c) => stage.states.includes(c.state)).length,
  }));
  const recentCards = recentIds
    .map((id) => data.cards.find((card) => card.id === id))
    .filter((card) => card !== undefined);
  const toggleRole = (role: Role) =>
    act(
      `/roles/${role.id}`,
      'PUT',
      {
        runtime: role.runtime,
        model: role.model,
        enabled: !role.enabled,
        instructions: role.instructions,
        capabilities: role.capabilities,
      },
      `${role.name} ${role.enabled ? 'paused' : 'resumed'}`,
    );
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
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
        theme={theme}
        onTheme={setTheme}
        dataDirectory={data.dataDirectory}
        onCopyDirectory={copyDirectory}
        working={working}
      />
      <SidebarInset id="main" tabIndex={-1}>
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
        </div>
        <m.div
          key={view}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`page ${view === 'chat' ? 'chat-page' : ''}`}
        >
          <header className="page-heading">
            <div>
              <h1>{view ? viewTitles[view] : 'Page not found'}</h1>
              <p>{summary}</p>
            </div>
            {view === 'board' && data.cards.length ? (
              <Button className="button primary" onClick={() => setAdd(true)}>
                <Plus size={16} /> Add job
              </Button>
            ) : view === 'crew' ? (
              <Button className="button" disabled={working} onClick={checkRuntimes}>
                <RefreshCw size={14} /> Check runtimes
              </Button>
            ) : null}
          </header>
          {error ? (
            <div role="alert" className="error-banner">
              Lost connection to the local daemon: {error}
            </div>
          ) : null}
          <Suspense fallback={<p className="quiet">Opening view…</p>}>
            <Outlet />
          </Suspense>
        </m.div>
      </SidebarInset>
      {paletteMounted ? (
        <Suspense fallback={null}>
          <CommandPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            cards={data.cards}
            roles={data.roles}
            onNavigate={go}
            onOpenCard={openCard}
            onConfigureRole={setRoleId}
            onChatRole={openChat}
            onAddJob={() => setAdd(true)}
            onCheckRuntimes={checkRuntimes}
            onTheme={setTheme}
            onCopyDirectory={copyDirectory}
          />
        </Suspense>
      ) : null}
      <AnimatePresence>
        {toast ? (
          <m.output
            key="notification"
            initial={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduced ? 0 : 8 }}
            className={`toast ${selectedRole ? 'toast-above-settings' : ''}`}
          >
            <span>{toast}</span>
            <Button
              className="icon-button"
              onClick={() => setToast('')}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </Button>
          </m.output>
        ) : null}
      </AnimatePresence>
      <Suspense fallback={null}>
        <AnimatePresence>
          {add ? (
            <AddOpportunity
              key="add-job"
              action={action}
              working={working}
              onClose={() => setAdd(false)}
            />
          ) : null}
          {selected ? (
            <CardDetails
              key={selected.id}
              card={selected}
              data={data}
              action={action}
              working={working}
              onClose={() => setSelectedId(null)}
              onInbox={() => go('inbox')}
            />
          ) : null}
          {selectedRole ? (
            <RoleSettings
              key={selectedRole.id}
              onManageSkills={() => {
                void navigate({ to: '/skills', search: { filter: selectedRole.id } });
                setRoleId(null);
              }}
              role={selectedRole}
              data={data}
              action={action}
              working={working}
              onClose={() => setRoleId(null)}
            />
          ) : null}
        </AnimatePresence>
      </Suspense>
    </SidebarProvider>
  );
}
