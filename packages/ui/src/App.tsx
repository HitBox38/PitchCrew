import { Input } from './components/ui/input.tsx';
import { Button } from './components/ui/button.tsx';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus,
  Search,
  ArrowRight,
  RefreshCw,
  LoaderCircle,
  X,
  SlidersHorizontal,
  MessageSquare,
} from 'lucide-react';
import type { Snapshot, Role, RoleId, ChatStreamState } from '@pitchcrew/core';
import { api } from './api.ts';
import { subscribeChatStream } from './chat-stream.ts';
import { Brand, EmptyState, JobCard, RoleAvatar, runtimeLabels, timeAgo } from './components.tsx';
import { useTheme } from './theme.ts';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar.tsx';
import { AppSidebar, viewTitles, type View } from './app-sidebar.tsx';
import { modKey, useShortcuts } from './shortcuts.ts';
// Views, dialogs and the command palette load on first use to keep the entry chunk small.
const views = () => import('./views.tsx');
const AddOpportunity = lazy(() => views().then((m) => ({ default: m.AddOpportunity })));
const CardDetails = lazy(() => views().then((m) => ({ default: m.CardDetails })));
const RoleSettings = lazy(() => views().then((m) => ({ default: m.RoleSettings })));
const ProfileView = lazy(() => views().then((m) => ({ default: m.ProfileView })));
const InboxView = lazy(() => views().then((m) => ({ default: m.InboxView })));
const CommandPalette = lazy(() =>
  import('./command-palette.tsx').then((m) => ({ default: m.CommandPalette })),
);
const ConnectorSettings = lazy(() =>
  import('./connector-settings.tsx').then((m) => ({ default: m.ConnectorSettings })),
);
const ChatView = lazy(() => import('./chat-view.tsx').then((m) => ({ default: m.ChatView })));
const closedStates = ['rejected', 'withdrawn', 'ghosted'];
const stages = [
  {
    id: 'lead',
    label: 'Leads',
    states: ['lead'],
    color: 'slate',
    empty: 'Add a job post to start.',
  },
  {
    id: 'shortlisted',
    label: 'Shortlisted',
    states: ['shortlisted'],
    color: 'blue',
    empty: 'Shortlist a lead once Scout has read it.',
  },
  {
    id: 'drafts',
    label: 'Drafting',
    states: ['drafting', 'in_review', 'changes_requested'],
    color: 'violet',
    empty: 'Writer’s drafts and Reviewer’s notes land here.',
  },
  {
    id: 'ready',
    label: 'Ready',
    states: ['agreed', 'awaiting_approval'],
    color: 'orange',
    empty: 'Reviewed packets wait here for your approval.',
  },
  {
    id: 'applied',
    label: 'Applied',
    states: ['submitted', 'screening', 'interviewing', 'offer'],
    color: 'green',
    empty: 'Record a submission after you apply.',
  },
];
const recentKey = 'pitchcrew-recent-jobs';
function readRecent(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(recentKey) ?? '[]');
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}
// The shadcn sidebar remembers its expanded state in a sidebar_state cookie.
const sidebarOpen = !document.cookie.split('; ').includes('sidebar_state=false');
export type Action = (
  path: string,
  method?: string,
  body?: unknown,
  success?: string | ((result: unknown) => string),
) => Promise<unknown>;
export function App() {
  const [data, setData] = useState<Snapshot | null>(null);
  const chatState = useRef<ChatStreamState | null>(null);
  useEffect(
    () =>
      subscribeChatStream(
        (state) => {
          chatState.current = state;
          setData((current) => (current ? { ...current, ...state } : current));
        },
        () => {
          chatState.current = null;
        },
      ),
    [],
  );
  const [chatThread, setChatThread] = useState<RoleId | 'crew'>('scout');
  const [view, setView] = useState<View>('board');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [working, setWorking] = useState(false);
  const [add, setAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<RoleId | null>(null);
  const [query, setQuery] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [theme, setTheme] = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMounted, setPaletteMounted] = useState(false);
  if (paletteOpen && !paletteMounted) setPaletteMounted(true);
  const [recentIds, setRecentIds] = useState(readRecent);
  const [flashStage, setFlashStage] = useState<string | null>(null);
  useShortcuts({ search: () => setPaletteOpen(true), newJob: () => setAdd(true) });
  useEffect(() => {
    if (!flashStage) return;
    document
      .getElementById(`stage-${flashStage}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    const timer = setTimeout(() => setFlashStage(null), 1400);
    return () => clearTimeout(timer);
  }, [flashStage]);
  const reload = useCallback(async () => {
    const next = await api<Snapshot>('/snapshot');
    setData({ ...next, ...chatState.current });
    setError('');
  }, []);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const snapshot = await api<Snapshot>('/snapshot');
        if (active) {
          setData({ ...snapshot, ...chatState.current });
          setError('');
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not connect to the daemon.');
      } finally {
        if (active) timer = setTimeout(poll, 2000);
      }
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);
  const action: Action = async (path, method = 'POST', body, success) => {
    setWorking(true);
    try {
      const result = await api<unknown>(path, method, body);
      await reload();
      if (success) setToast(typeof success === 'function' ? success(result) : success);
      return result;
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Action failed.');
      throw e;
    } finally {
      setWorking(false);
    }
  };
  const act = (path: string, method = 'POST', body?: unknown, success?: string) => {
    void action(path, method, body, success).catch(() => {});
  };
  const pending = data?.approvals.filter((a) => a.status === 'pending').length ?? 0;
  const selected = data?.cards.find((c) => c.id === selectedId);
  const selectedRole = data?.roles.find((r) => r.id === roleId);
  const go = (next: View) => {
    setView(next);
    setSelectedId(null);
  };
  const openChat = (id: RoleId) => {
    setChatThread(id);
    go('chat');
  };
  const openCard = (id: string) => {
    setSelectedId(id);
    setRecentIds((ids) => {
      const next = [id, ...ids.filter((other) => other !== id)].slice(0, 5);
      try {
        localStorage.setItem(recentKey, JSON.stringify(next));
      } catch {
        /* Recents are a convenience; ignore unavailable storage. */
      }
      return next;
    });
  };
  const jumpToStage = (id: string) => {
    setView('board');
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
  const filtered = data.cards.filter((c) =>
    `${c.company} ${c.title} ${c.location} ${c.tags.join(' ')}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const closed = filtered.filter((c) => closedStates.includes(c.state));
  const running = data.runs.filter((r) => r.status === 'running');
  const recent = data.events.filter((e) => e.kind !== 'role').slice(0, 4);
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
          <strong>{pending}</strong> {pending === 1 ? 'export is' : 'exports are'} waiting on you.
        </>
      ) : (
        'Nothing is waiting on you.'
      )
    ) : view === 'profile' ? (
      'Writer only quotes from these notes, and Reviewer checks every claim against them.'
    ) : (
      `${data.events.length} events, newest first. The log is append-only.`
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
        onNavigate={go}
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
        <div className={`page ${view === 'chat' ? 'chat-page' : ''}`}>
          <header className="page-heading">
            <div>
              <h1>{viewTitles[view]}</h1>
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
          {view === 'board' ? (
            !data.cards.length ? (
              <section className="welcome">
                <h2>Start with a job post</h2>
                <p>
                  Add a listing you’re considering. The crew works on it one step at a time, and
                  only when you ask.
                </p>
                <ol className="welcome-steps">
                  <li>
                    <RoleAvatar agentRole="scout" size="small" />
                    <span>
                      <strong>Scout</strong> reads the post and scores the fit against your profile.
                    </span>
                  </li>
                  <li>
                    <RoleAvatar agentRole="writer" size="small" />
                    <span>
                      <strong>Writer</strong> drafts a resume, cover letter and form answers,
                      quoting only your notes.
                    </span>
                  </li>
                  <li>
                    <RoleAvatar agentRole="reviewer" size="small" />
                    <span>
                      <strong>Reviewer</strong> checks every claim against those notes.
                    </span>
                  </li>
                  <li>
                    <span className="step-you">You</span>
                    <span>
                      approve the exact packet before it’s exported to a folder. Nothing is
                      submitted for you.
                    </span>
                  </li>
                </ol>
                <div className="welcome-actions">
                  <Button className="button primary" onClick={() => setAdd(true)}>
                    <Plus size={16} /> Add job
                  </Button>
                  <Button
                    className="button"
                    disabled={working}
                    onClick={() =>
                      act('/examples', 'POST', undefined, 'Loaded example jobs (demo runtime)')
                    }
                  >
                    {working ? <LoaderCircle size={14} className="spin" /> : null} Load example data
                  </Button>
                </div>
              </section>
            ) : (
              <>
                <div className="board-toolbar">
                  <div className="view-switch">
                    <Button
                      className={!showClosed ? 'active' : ''}
                      onClick={() => setShowClosed(false)}
                    >
                      Pipeline
                    </Button>
                    <Button
                      className={showClosed ? 'active' : ''}
                      onClick={() => setShowClosed(true)}
                    >
                      Closed <span>{data.cards.length - active.length}</span>
                    </Button>
                  </div>
                  <div className="search-input">
                    <Search size={15} />
                    <Input
                      aria-label="Search jobs"
                      placeholder="Filter by company, title, tag"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query ? (
                      <Button
                        className="icon-button"
                        onClick={() => setQuery('')}
                        aria-label="Clear search"
                      >
                        <X size={14} />
                      </Button>
                    ) : null}
                  </div>
                </div>
                {showClosed ? (
                  <div className="closed-grid">
                    {closed.length ? (
                      closed.map((card) => (
                        <JobCard key={card.id} card={card} onOpen={() => openCard(card.id)} />
                      ))
                    ) : (
                      <EmptyState
                        title="Nothing closed"
                        description="Rejected, withdrawn and unanswered applications end up here."
                      />
                    )}
                  </div>
                ) : (
                  <div className="pipeline" aria-label="Application pipeline">
                    {stages.map((stage) => {
                      const cards = filtered.filter((c) => stage.states.includes(c.state));
                      return (
                        <section
                          className={`pipeline-column ${stage.color} ${flashStage === stage.id ? 'flash' : ''}`}
                          id={`stage-${stage.id}`}
                          key={stage.id}
                        >
                          <div className="column-heading">
                            <span className="stage-dot" />
                            <h2>{stage.label}</h2>
                            <span className="column-count">{cards.length}</span>
                            {stage.id === 'lead' ? (
                              <Button
                                className="icon-button"
                                aria-label="Add a job"
                                onClick={() => setAdd(true)}
                              >
                                <Plus size={15} />
                              </Button>
                            ) : null}
                          </div>
                          <div className="column-cards">
                            {cards.map((card) => (
                              <JobCard key={card.id} card={card} onOpen={() => openCard(card.id)} />
                            ))}
                            {!cards.length ? (
                              <p className="column-empty">{query ? 'No matches.' : stage.empty}</p>
                            ) : null}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
                {recent.length ? (
                  <section className="recent">
                    <div className="section-heading">
                      <h2>Recent</h2>
                      <Button className="text-button" onClick={() => go('activity')}>
                        All activity <ArrowRight size={13} />
                      </Button>
                    </div>
                    <ul>
                      {recent.map((event) => (
                        <li key={event.id}>
                          <span>{event.message}</span>
                          <time dateTime={event.createdAt}>{timeAgo(event.createdAt)}</time>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            )
          ) : null}
          {view === 'crew' ? (
            <>
              <div className="crew-grid">
                {data.roles.map((role) => (
                  <CrewCard
                    key={role.id}
                    role={role}
                    status={roleStatus(role)}
                    onConfigure={() => setRoleId(role.id)}
                    onChat={() => openChat(role.id)}
                  />
                ))}
              </div>
              <Suspense fallback={<p className="quiet">Loading connectors…</p>}>
                <ConnectorSettings data={data} action={action} working={working} />
              </Suspense>
              <h2 className="subheading">Runtimes on this machine</h2>
              <div className="runtime-list">
                {data.runtimes.map((runtime) => (
                  <div className="runtime-row" key={runtime.id}>
                    <div>
                      <strong>{runtimeLabels[runtime.id]}</strong>
                      <p>{runtime.detail}</p>
                    </div>
                    {runtime.version ? <small>{runtime.version}</small> : null}
                    <span className={`badge ${runtime.available ? 'success' : ''}`}>
                      {runtime.available ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="info-note">
                Demo makes deterministic drafts without calling a model. Other runtimes use their
                native authentication for conversations and job workflows.
              </p>
            </>
          ) : null}
          <Suspense fallback={<p className="quiet">Opening view…</p>}>
            {view === 'chat' ? (
              <ChatView
                data={data}
                thread={chatThread}
                onThread={setChatThread}
                onConfigure={setRoleId}
                onOpenCard={openCard}
                action={action}
                working={working}
              />
            ) : null}
            {view === 'inbox' ? (
              <InboxView data={data} action={action} working={working} onOpen={openCard} />
            ) : null}
            {view === 'profile' ? (
              <ProfileView data={data} action={action} working={working} />
            ) : null}
          </Suspense>
          {view === 'activity' ? (
            <section className="activity-panel">
              <ol className="activity-list">
                {data.events.map((event) => (
                  <li className={`activity-row ${event.kind}`} key={event.id}>
                    <time dateTime={event.createdAt} title={event.createdAt}>
                      {timeAgo(event.createdAt)}
                    </time>
                    <span className="activity-message">{event.message}</span>
                    <span className="activity-actor">
                      {event.actor === 'user'
                        ? 'You'
                        : event.actor === 'demo'
                          ? 'Demo runtime'
                          : event.actor}
                      <span className="activity-kind">{event.kind}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
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
      {toast ? (
        <output className={`toast ${selectedRole ? 'toast-above-settings' : ''}`}>
          <span>{toast}</span>
          <Button
            className="icon-button"
            onClick={() => setToast('')}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </Button>
        </output>
      ) : null}
      <Suspense fallback={null}>
        {add ? (
          <AddOpportunity action={action} working={working} onClose={() => setAdd(false)} />
        ) : null}
        {selected ? (
          <CardDetails
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
            role={selectedRole}
            data={data}
            action={action}
            working={working}
            onClose={() => setRoleId(null)}
          />
        ) : null}
      </Suspense>
    </SidebarProvider>
  );
}
function CrewCard({
  role,
  status,
  onConfigure,
  onChat,
}: {
  role: Role;
  status: string;
  onConfigure: () => void;
  onChat: () => void;
}) {
  return (
    <section className={`crew-card ${role.id}`}>
      <div className="crew-card-top">
        <RoleAvatar agentRole={role.id} size="large" />
        <div>
          <h2>{role.name}</h2>
          <span className={`role-status ${!role.enabled ? 'paused' : ''}`}>
            {role.enabled ? 'Enabled' : 'Paused'}
          </span>
        </div>
      </div>
      <p>{role.description}</p>
      <dl className="crew-runtime">
        <div>
          <dt>Runtime</dt>
          <dd>{runtimeLabels[role.runtime]}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{role.model || 'CLI default'}</dd>
        </div>
        <div>
          <dt>Now</dt>
          <dd>{status.startsWith('Working') ? status : 'Idle'}</dd>
        </div>
      </dl>
      <Button className="button primary" onClick={onChat}>
        <MessageSquare size={14} /> Chat
      </Button>
      <Button className="button" onClick={onConfigure}>
        <SlidersHorizontal size={14} /> Configure
      </Button>
    </section>
  );
}
