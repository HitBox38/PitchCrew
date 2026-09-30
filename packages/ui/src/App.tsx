import { Input } from './components/ui/input.tsx';
import { Button } from './components/ui/button.tsx';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  Inbox,
  FileUser,
  Activity,
  Plus,
  Search,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  CircleCheck,
  Play,
  RefreshCw,
  Monitor,
  LockKeyhole,
  LoaderCircle,
  X,
  ChevronRight,
  SlidersHorizontal,
  Layers,
  Target,
  BriefcaseBusiness,
} from 'lucide-react';
import type { Snapshot, Role, RoleId } from '@pitchcrew/core';
import { api } from './api.ts';
import {
  Brand,
  EmptyState,
  JobCard,
  Modal,
  RoleAvatar,
  runtimeLabels,
  timeAgo,
} from './components.tsx';
import { AddOpportunity, CardDetails, RoleSettings, ProfileView, InboxView } from './views.tsx';
type View = 'board' | 'crew' | 'inbox' | 'profile' | 'activity';
const navigation = [
  { id: 'board', label: 'Application board', icon: LayoutDashboard },
  { id: 'crew', label: 'Your crew', icon: Users },
  { id: 'inbox', label: 'Approval inbox', icon: Inbox },
  { id: 'profile', label: 'Your profile', icon: FileUser },
  { id: 'activity', label: 'Activity', icon: Activity },
] as const;
const viewTitles = {
  board: 'Application board',
  crew: 'Your crew',
  inbox: 'Approval inbox',
  profile: 'Your profile',
  activity: 'Activity',
};
const stages = [
  { id: 'lead', label: 'Leads', states: ['lead'], color: 'slate' },
  { id: 'shortlisted', label: 'Shortlisted', states: ['shortlisted'], color: 'blue' },
  {
    id: 'drafts',
    label: 'In progress',
    states: ['drafting', 'in_review', 'changes_requested'],
    color: 'violet',
  },
  { id: 'ready', label: 'Ready to go', states: ['agreed', 'awaiting_approval'], color: 'orange' },
  {
    id: 'applied',
    label: 'Applied',
    states: ['submitted', 'screening', 'interviewing', 'offer'],
    color: 'green',
  },
];
export type Action = (
  path: string,
  method?: string,
  body?: unknown,
  success?: string | ((result: unknown) => string),
) => Promise<unknown>;
export function App() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [view, setView] = useState<View>('board');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [working, setWorking] = useState(false);
  const [add, setAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<RoleId | null>(null);
  const [query, setQuery] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const reload = useCallback(async () => {
    const next = await api<Snapshot>('/snapshot');
    setData(next);
    setError('');
  }, []);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const snapshot = await api<Snapshot>('/snapshot');
        if (active) {
          setData(snapshot);
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
          <LoaderCircle className="spin" size={24} />
        )}
      </div>
    );
  const active = data.cards.filter((c) => !['rejected', 'withdrawn', 'ghosted'].includes(c.state));
  const filtered = data.cards.filter((c) =>
    `${c.company} ${c.title} ${c.location} ${c.tags.join(' ')}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const closed = filtered.filter((c) => ['rejected', 'withdrawn', 'ghosted'].includes(c.state));
  const running = data.runs.filter((r) => r.status === 'running');
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">
          <span className="workspace-icon">
            <BriefcaseBusiness size={16} />
          </span>
          <div>
            <strong>My workspace</strong>
            <span>Personal job search</span>
          </div>
          <ChevronRight size={14} />
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <Button
              key={item.id}
              className={`nav-item ${view === item.id ? 'selected' : ''}`}
              aria-label={item.label}
              title={item.label}
              onClick={() => go(item.id)}
              aria-current={view === item.id ? 'page' : undefined}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === 'inbox' && pending ? <span className="nav-count">{pending}</span> : null}
            </Button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-graphic">
            <Layers size={22} />
            <span className="little-star">✦</span>
          </span>
          <strong>
            A little teamwork.
            <br />A bigger next chapter.
          </strong>
          <p>
            Your crew does the groundwork.
            <br />
            You make the next move.
          </p>
          <Button onClick={() => go('crew')}>
            Meet your crew <ArrowRight size={14} />
          </Button>
        </div>
        <div className="sidebar-footer">
          <span className="local-dot" />
          <span>Local workspace</span>
          <LockKeyhole size={13} />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <ChevronRight size={13} /> <strong>{viewTitles[view]}</strong>
          </span>
          <span className="connection">
            <span className="local-dot" />
            {running.length
              ? `${running.length} role${running.length > 1 ? 's' : ''} working`
              : 'All systems ready'}
          </span>
          <Button
            className="profile-badge"
            onClick={() => go('profile')}
            aria-label="Open your profile"
          >
            <FileUser size={18} />
          </Button>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <h1>{viewTitles[view]}</h1>
              <p>
                {view === 'board'
                  ? 'Good opportunities. Thoughtful applications. Your next chapter.'
                  : view === 'crew'
                    ? 'Different strengths. One shared goal. Make the crew your own.'
                    : view === 'inbox'
                      ? 'You decide what happens next. Every action starts with your approval.'
                      : view === 'profile'
                        ? 'Your experience is the source of truth for every application.'
                        : 'Every move your crew makes, in one place.'}
              </p>
            </div>
            {view === 'board' ? (
              <Button className="button primary" onClick={() => setAdd(true)}>
                <Plus size={17} /> Add opportunity
              </Button>
            ) : view === 'crew' ? (
              <Button
                className="button"
                disabled={working}
                onClick={() =>
                  act('/runtimes/detect', 'POST', undefined, 'Runtime availability refreshed')
                }
              >
                <RefreshCw size={15} /> Check runtimes
              </Button>
            ) : null}
          </div>
          {error ? (
            <div role="alert" className="error-banner">
              Connection interrupted: {error}
            </div>
          ) : null}
          {view === 'board' ? (
            <>
              <div className="metrics">
                <Metric
                  icon={<Layers size={18} />}
                  value={active.length}
                  label="Active opportunities"
                />
                <Metric
                  icon={<Target size={18} />}
                  value={data.cards.filter((c) => c.fit !== null && c.fit >= 80).length}
                  label="Strong matches"
                />
                <Metric
                  icon={<ShieldCheck size={18} />}
                  value={pending}
                  label="Need your approval"
                />
                <Metric
                  icon={<BriefcaseBusiness size={18} />}
                  value={
                    data.cards.filter((c) => ['interviewing', 'offer'].includes(c.state)).length
                  }
                  label="In conversation"
                />
              </div>
              <div className="board-toolbar">
                <div className="view-switch">
                  <Button
                    className={!showClosed ? 'active' : ''}
                    onClick={() => setShowClosed(false)}
                  >
                    <LayoutDashboard size={15} /> Pipeline
                  </Button>
                  <Button
                    className={showClosed ? 'active' : ''}
                    onClick={() => setShowClosed(true)}
                  >
                    Closed <span>{data.cards.length - active.length}</span>
                  </Button>
                </div>
                <div className="search-input">
                  <Search size={16} />
                  <Input
                    aria-label="Search opportunities"
                    placeholder="Search opportunities…"
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
                <span className="board-count">{filtered.length} opportunities</span>
              </div>
              {!data.cards.length ? (
                <div className="welcome">
                  <div className="welcome-art" aria-hidden="true">
                    <span className="art-line" />
                    <RoleAvatar agentRole="scout" size="large" />
                    <RoleAvatar agentRole="writer" size="large" />
                    <RoleAvatar agentRole="reviewer" size="large" />
                    <span className="art-spark">✦</span>
                  </div>
                  <span className="welcome-label">Your crew is ready when you are</span>
                  <h2>
                    Great things start
                    <br />
                    with a first opportunity.
                  </h2>
                  <p>
                    Add a role you’re excited about. Your crew will help you
                    <br className="desktop-break" /> find the fit, tell your story, and get it
                    ready.
                  </p>
                  <div className="welcome-actions">
                    <Button className="button primary" onClick={() => setAdd(true)}>
                      <Plus size={16} /> Add your first opportunity
                    </Button>
                    <Button
                      className="button"
                      disabled={working}
                      onClick={() =>
                        act(
                          '/examples',
                          'POST',
                          undefined,
                          'Loaded fictional examples with the demo runtime',
                        )
                      }
                    >
                      {working ? <LoaderCircle size={15} className="spin" /> : <Play size={15} />}{' '}
                      Try an example board
                    </Button>
                  </div>
                  <div className="welcome-steps">
                    <span>
                      <Search size={15} /> Find your fit
                    </span>
                    <ChevronRight size={13} />
                    <span>
                      <FileUser size={15} /> Tell your story
                    </span>
                    <ChevronRight size={13} />
                    <span>
                      <ShieldCheck size={15} /> Make your move
                    </span>
                  </div>
                </div>
              ) : showClosed ? (
                <div className="closed-grid">
                  {closed.length ? (
                    closed.map((card) => (
                      <JobCard key={card.id} card={card} onOpen={() => setSelectedId(card.id)} />
                    ))
                  ) : (
                    <EmptyState
                      title="Nothing closed yet"
                      description="Rejected, withdrawn, and unanswered applications appear here."
                    />
                  )}
                </div>
              ) : (
                <div className="pipeline" aria-label="Application pipeline">
                  {stages.map((stage) => {
                    const cards = filtered.filter((c) => stage.states.includes(c.state));
                    return (
                      <section className={`pipeline-column ${stage.color}`} key={stage.id}>
                        <div className="column-heading">
                          <span className="stage-dot" />
                          <h2>{stage.label}</h2>
                          <span className="column-count">{cards.length}</span>
                          {stage.id === 'lead' ? (
                            <Button
                              className="icon-button"
                              aria-label="Add a new lead"
                              onClick={() => setAdd(true)}
                            >
                              <Plus size={15} />
                            </Button>
                          ) : null}
                        </div>
                        <div className="column-cards">
                          {cards.map((card) => (
                            <JobCard
                              key={card.id}
                              card={card}
                              onOpen={() => setSelectedId(card.id)}
                            />
                          ))}
                          {!cards.length ? (
                            <div className="column-empty">
                              {query
                                ? 'No matching opportunities'
                                : stage.id === 'lead'
                                  ? 'Your next possibility starts here'
                                  : stage.id === 'shortlisted'
                                    ? 'Keep the roles worth exploring'
                                    : stage.id === 'drafts'
                                      ? 'Your crew’s work lands here'
                                      : stage.id === 'ready'
                                        ? 'Reviewed and ready for you'
                                        : 'Your next chapter is on its way'}
                            </div>
                          ) : null}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
              <div className="board-bottom">
                <section className="crew-summary">
                  <div className="section-heading">
                    <h2>Your crew, at a glance</h2>
                    <Button className="text-button" onClick={() => go('crew')}>
                      Manage crew <ArrowUpRight size={14} />
                    </Button>
                  </div>
                  <div className="crew-summary-list">
                    {data.roles.map((role) => (
                      <Button
                        key={role.id}
                        onClick={() => setRoleId(role.id)}
                        className="crew-summary-role"
                      >
                        <RoleAvatar agentRole={role.id} />
                        <span>
                          <strong>{role.name}</strong>
                          <small>{runtimeLabels[role.runtime]}</small>
                        </span>
                        <span className={`role-status ${!role.enabled ? 'paused' : ''}`}>
                          <span />
                          {!role.enabled
                            ? 'Paused'
                            : running.some((r) => r.roleId === role.id)
                              ? 'Working'
                              : 'Ready'}
                        </span>
                      </Button>
                    ))}
                  </div>
                </section>
                <section className="recent-activity">
                  <div className="section-heading">
                    <h2>Recent activity</h2>
                    <Button className="text-button" onClick={() => go('activity')}>
                      View all <ArrowUpRight size={14} />
                    </Button>
                  </div>
                  {data.events
                    .filter((e) => e.kind !== 'role')
                    .slice(0, 2)
                    .map((event) => (
                      <div className="recent-event" key={event.id}>
                        <CircleCheck size={16} />
                        <span>{event.message}</span>
                        <time>{timeAgo(event.createdAt)}</time>
                      </div>
                    ))}
                  {!data.events.some((e) => e.kind !== 'role') ? (
                    <p className="quiet">A fresh start. Your crew’s activity will show up here.</p>
                  ) : null}
                </section>
              </div>
              <div className="page-footnote">
                <LockKeyhole size={13} /> Your workspace stays on this device. Nothing is sent
                without your say.
              </div>
            </>
          ) : null}
          {view === 'crew' ? (
            <>
              <div className="callout">
                <span className="callout-icon">
                  <Users size={21} />
                </span>
                <div>
                  <strong>A crew that works your way</strong>
                  <p>
                    Pick a runtime for each role. Your installed CLIs handle their own sign-in;
                    Pitchcrew gives them a shared board.
                  </p>
                </div>
                <span className="badge">3 specialist roles</span>
              </div>
              <div className="crew-grid">
                {data.roles.map((role) => (
                  <CrewCard
                    key={role.id}
                    role={role}
                    active={running.some((r) => r.roleId === role.id)}
                    onConfigure={() => setRoleId(role.id)}
                  />
                ))}
              </div>
              <h2 className="subheading">Available runtimes</h2>
              <div className="runtime-list">
                {data.runtimes.map((runtime) => (
                  <div className="runtime-row" key={runtime.id}>
                    <Monitor size={22} />
                    <div>
                      <strong>{runtimeLabels[runtime.id]}</strong>
                      <p>{runtime.detail}</p>
                    </div>
                    <span className={`badge ${runtime.available ? 'success' : ''}`}>
                      {runtime.available ? 'Available' : 'Not installed'}
                    </span>
                    {runtime.version ? <small>{runtime.version}</small> : null}
                  </div>
                ))}
              </div>
              <div className="info-note">
                <ShieldCheck size={17} />
                <p>
                  The demo runtime makes deterministic drafts without AI calls. Selecting Claude
                  Code or Codex uses your CLI’s account when you explicitly start a run.
                </p>
              </div>
            </>
          ) : null}
          {view === 'inbox' ? (
            <InboxView data={data} action={action} working={working} onOpen={setSelectedId} />
          ) : null}
          {view === 'profile' ? (
            <ProfileView data={data} action={action} working={working} />
          ) : null}
          {view === 'activity' ? (
            <section className="activity-panel">
              <div className="section-heading">
                <h2>Workspace history</h2>
                <span className="badge">Append-only event log</span>
              </div>
              <div className="activity-list">
                {data.events.map((event) => (
                  <div className="activity-row" key={event.id}>
                    <span className={`event-dot ${event.kind}`}>
                      {event.kind === 'run' ? (
                        <Play size={14} />
                      ) : event.kind === 'approval' ? (
                        <ShieldCheck size={14} />
                      ) : event.kind === 'role' ? (
                        <Users size={14} />
                      ) : (
                        <Layers size={14} />
                      )}
                    </span>
                    <div>
                      <strong>{event.message}</strong>
                      <p>
                        {event.actor === 'user'
                          ? 'You'
                          : event.actor === 'demo'
                            ? 'Demo runtime'
                            : event.actor}{' '}
                        <span>•</span> {event.kind}
                      </p>
                    </div>
                    <time dateTime={event.createdAt}>{timeAgo(event.createdAt)}</time>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </main>
      </div>
      {toast ? (
        <output className="toast">
          <span>{toast}</span>
          <Button
            className="icon-button"
            onClick={() => setToast('')}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </Button>
        </output>
      ) : null}
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
        <Modal title={`${selectedRole.name} settings`} onClose={() => setRoleId(null)}>
          <RoleSettings
            role={selectedRole}
            data={data}
            action={action}
            working={working}
            onClose={() => setRoleId(null)}
          />
        </Modal>
      ) : null}
    </div>
  );
}
function Metric({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="metric">
      <span className="metric-icon">{icon}</span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
function CrewCard({
  role,
  active,
  onConfigure,
}: {
  role: Role;
  active: boolean;
  onConfigure: () => void;
}) {
  return (
    <section className="crew-card">
      <div className="crew-card-top">
        <RoleAvatar agentRole={role.id} size="large" />
        <span className={`role-status ${!role.enabled ? 'paused' : ''}`}>
          <span />
          {role.enabled ? (active ? 'Working' : 'Ready') : 'Paused'}
        </span>
      </div>
      <h2>{role.name}</h2>
      <p>{role.description}</p>
      <div className="crew-runtime">
        <Monitor size={15} />
        {runtimeLabels[role.runtime]}
        <span>{role.model || 'Default model'}</span>
      </div>
      <Button className="button" onClick={onConfigure}>
        <SlidersHorizontal size={15} /> Configure role
      </Button>
    </section>
  );
}
