import { Input } from './components/ui/input.tsx';
import { Button } from './components/ui/button.tsx';
import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Inbox,
  FileUser,
  Activity,
  Plus,
  Search,
  ArrowRight,
  RefreshCw,
  LoaderCircle,
  X,
  SlidersHorizontal,
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
  { id: 'board', label: 'Board', icon: LayoutDashboard },
  { id: 'crew', label: 'Crew', icon: Users },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'profile', label: 'Profile', icon: FileUser },
  { id: 'activity', label: 'Activity', icon: Activity },
] as const;
const viewTitles = {
  board: 'Board',
  crew: 'Crew',
  inbox: 'Inbox',
  profile: 'Profile',
  activity: 'Activity',
};
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
      'Pick a runtime for each role. A run only starts when you start it from a card.'
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
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Main navigation">
          {navigation.map((item) => {
            const count = item.id === 'board' ? active.length : item.id === 'inbox' ? pending : 0;
            return (
              <Button
                key={item.id}
                className={`nav-item ${view === item.id ? 'selected' : ''}`}
                aria-label={item.label}
                title={item.label}
                onClick={() => go(item.id)}
                aria-current={view === item.id ? 'page' : undefined}
              >
                <item.icon size={17} />
                <span>{item.label}</span>
                {count ? (
                  <span className={`nav-count ${item.id === 'inbox' ? 'attention' : ''}`}>
                    {count}
                  </span>
                ) : null}
              </Button>
            );
          })}
        </nav>
        <section className="sidebar-crew" aria-labelledby="sidebar-crew-heading">
          <h2 id="sidebar-crew-heading">Crew</h2>
          {data.roles.map((role) => (
            <Button
              key={role.id}
              className={`sidebar-role ${!role.enabled ? 'paused' : ''}`}
              onClick={() => setRoleId(role.id)}
              title={`${role.name} settings`}
            >
              <RoleAvatar agentRole={role.id} size="small" />
              <span>
                <strong>{role.name}</strong>
                <small>{roleStatus(role)}</small>
              </span>
              {running.some((r) => r.roleId === role.id) ? (
                <LoaderCircle size={13} className="spin" aria-label="Running" />
              ) : null}
            </Button>
          ))}
        </section>
        <p className="sidebar-footer" title={data.dataDirectory}>
          Saved locally in{' '}
          <code>
            <bdi>{data.dataDirectory}</bdi>
          </code>
        </p>
      </aside>
      <div className="main-shell">
        <main id="main" tabIndex={-1}>
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
              <Button
                className="button"
                disabled={working}
                onClick={() =>
                  act('/runtimes/detect', 'POST', undefined, 'Checked installed runtimes')
                }
              >
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
                        <JobCard key={card.id} card={card} onOpen={() => setSelectedId(card.id)} />
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
                        <section className={`pipeline-column ${stage.color}`} key={stage.id}>
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
                              <JobCard
                                key={card.id}
                                card={card}
                                onOpen={() => setSelectedId(card.id)}
                              />
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
                  />
                ))}
              </div>
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
                      {runtime.available ? 'Available' : 'Not installed'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="info-note">
                Demo makes deterministic drafts without calling a model. Claude Code and Codex run
                under your own CLI login, and only when you start a run.
              </p>
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
            <X size={15} />
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
function CrewCard({
  role,
  status,
  onConfigure,
}: {
  role: Role;
  status: string;
  onConfigure: () => void;
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
      <Button className="button" onClick={onConfigure}>
        <SlidersHorizontal size={14} /> Configure
      </Button>
    </section>
  );
}
