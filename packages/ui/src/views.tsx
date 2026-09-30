import { Textarea } from './components/ui/textarea.tsx';
import { NativeSelect, NativeSelectOption } from './components/ui/native-select.tsx';
import { Checkbox } from './components/ui/checkbox.tsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs.tsx';
import { Input } from './components/ui/input.tsx';
import { Button } from './components/ui/button.tsx';
import { useState, type FormEvent } from 'react';
import {
  Plus,
  MapPin,
  ExternalLink,
  Play,
  ArrowRight,
  ShieldCheck,
  FileText,
  History,
  Check,
  X,
  Download,
  FolderOpen,
  LoaderCircle,
  FileCheck,
} from 'lucide-react';
import type { Card, CardState, Packet, Role, Snapshot } from '@pitchcrew/core';
import { transitions } from '@pitchcrew/core';
import type { Action } from './App.tsx';
import {
  CompanyMark,
  EmptyState,
  Modal,
  runtimeLabels,
  stateLabels,
  timeAgo,
} from './components.tsx';
export function AddOpportunity({
  action,
  working,
  onClose,
}: {
  action: Action;
  working: boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError('');
    try {
      await action(
        '/cards',
        'POST',
        {
          company: form.get('company'),
          title: form.get('title'),
          location: form.get('location'),
          url: form.get('url'),
          salary: form.get('salary'),
          description: form.get('description'),
          tags: String(form.get('tags'))
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
        'Opportunity added to your board',
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add opportunity.');
    }
  }
  return (
    <Modal title="A new opportunity" onClose={onClose}>
      <p className="modal-intro">Found something interesting? Give your crew a place to start.</p>
      <form onSubmit={(e) => void submit(e)} className="form">
        <div className="form-row">
          <label>
            Company
            <Input
              name="company"
              required
              maxLength={100}
              placeholder="e.g. Linear"
              autoComplete="organization"
            />
          </label>
          <label>
            Role title
            <Input
              name="title"
              required
              maxLength={160}
              placeholder="e.g. Senior Frontend Engineer"
            />
          </label>
        </div>
        <label>
          Job post URL <span className="optional">optional</span>
          <Input name="url" type="url" placeholder="https://…" />
        </label>
        <div className="form-row">
          <label>
            Location
            <Input
              name="location"
              placeholder="Remote, hybrid, or a city"
              defaultValue="Remote"
              maxLength={120}
            />
          </label>
          <label>
            Salary range <span className="optional">optional</span>
            <Input name="salary" placeholder="e.g. $100k–$130k" maxLength={100} />
          </label>
        </div>
        <label>
          Job description
          <Textarea
            name="description"
            rows={5}
            placeholder="Paste the job description so your crew can understand the role."
            maxLength={20000}
          />
        </label>
        <label>
          Tags <span className="optional">comma separated, up to 10</span>
          <Input name="tags" placeholder="React, TypeScript, Remote" />
        </label>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-footer">
          <Button type="button" className="button" onClick={onClose}>
            Cancel
          </Button>
          <Button className="button primary" disabled={working}>
            {working ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Add
            opportunity
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function CardDetails({
  card,
  data,
  action,
  working,
  onClose,
  onInbox,
}: {
  card: Card;
  data: Snapshot;
  action: Action;
  working: boolean;
  onClose: () => void;
  onInbox: () => void;
}) {
  const [tab, setTab] = useState<'overview' | 'packet' | 'history'>('overview');
  const [document, setDocument] = useState<keyof Omit<Packet, 'claims'>>('resume');
  const act = (path: string, body?: unknown, success?: string) => {
    void action(path, 'POST', body, success).catch(() => {});
  };
  const run = data.runs.find((r) => r.cardId === card.id && r.status === 'running');
  const failed = data.runs.find((r) => r.cardId === card.id && r.status === 'failed');
  const exported = data.approvals.some(
    (a) =>
      a.cardId === card.id &&
      a.status === 'consumed' &&
      a.exportDirectory &&
      JSON.stringify(a.packet) === JSON.stringify(card.packet),
  );
  const runRole =
    card.state === 'lead'
      ? 'scout'
      : ['shortlisted', 'changes_requested'].includes(card.state)
        ? 'writer'
        : card.state === 'in_review'
          ? 'reviewer'
          : null;
  return (
    <Modal title="Opportunity details" onClose={onClose} drawer>
      <div className="detail-company">
        <CompanyMark name={card.company} />
        <div>
          <span>
            {card.company}
            {card.sample ? <span className="badge">Example</span> : null}
          </span>
          <h2>{card.title}</h2>
        </div>
      </div>
      <div className="detail-meta">
        <span>
          <MapPin size={14} />
          {card.location}
        </span>
        {card.salary ? <span>{card.salary}</span> : null}
        {card.url ? (
          <a href={card.url} target="_blank" rel="noreferrer">
            Job post <ExternalLink size={13} />
          </a>
        ) : null}
      </div>
      <div className="detail-state">
        <span className={`state-pill ${card.state}`}>{stateLabels[card.state]}</span>
        {card.fit !== null ? <strong>{card.fit}% fit</strong> : null}
      </div>
      <div className="detail-actions">
        {run ? (
          <>
            <span className="running-note">
              <LoaderCircle size={16} className="spin" />
              {run.message}
            </span>
            <Button className="button" onClick={() => act(`/runs/${run.id}/cancel`)}>
              Cancel run
            </Button>
          </>
        ) : (
          <>
            {runRole ? (
              <Button
                disabled={working}
                className="button primary"
                onClick={() =>
                  act(
                    `/cards/${card.id}/run`,
                    { roleId: runRole },
                    `${runRole[0].toUpperCase() + runRole.slice(1)} started`,
                  )
                }
              >
                <Play size={15} />
                {runRole === 'scout'
                  ? 'Evaluate fit'
                  : runRole === 'writer'
                    ? 'Draft application'
                    : 'Review packet'}
              </Button>
            ) : null}
            {card.state === 'lead' ? (
              <Button
                disabled={working}
                className="button"
                onClick={() =>
                  act(`/cards/${card.id}/move`, { state: 'shortlisted' }, 'Opportunity shortlisted')
                }
              >
                Shortlist <ArrowRight size={15} />
              </Button>
            ) : null}
            {card.state === 'agreed' ? (
              <Button
                disabled={working}
                className="button primary"
                onClick={() =>
                  act(
                    `/cards/${card.id}/approval`,
                    undefined,
                    'Packet is waiting in your approval inbox',
                  )
                }
              >
                <ShieldCheck size={15} /> Request export approval
              </Button>
            ) : null}
            {card.state === 'awaiting_approval' && !exported ? (
              <Button className="button primary" onClick={onInbox}>
                <ShieldCheck size={15} /> Open approval inbox
              </Button>
            ) : null}
            {card.state === 'awaiting_approval' && exported ? (
              <Button
                disabled={working}
                className="button primary"
                onClick={() =>
                  act(
                    `/cards/${card.id}/move`,
                    { state: 'submitted' },
                    'Recorded your manual submission',
                  )
                }
              >
                <Check size={15} /> Record manual submission
              </Button>
            ) : null}
          </>
        )}
      </div>
      {runRole ? (
        <p className="action-hint">
          Uses {runtimeLabels[data.roles.find((r) => r.id === runRole)!.runtime]}.{' '}
          {data.roles.find((r) => r.id === runRole)!.runtime === 'demo'
            ? 'No AI calls.'
            : 'Starting a run uses your CLI account.'}
        </p>
      ) : null}
      {failed && !run ? <p className="form-error">Last run: {failed.message}</p> : null}
      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList className="detail-tabs" aria-label="Opportunity sections">
          {(['overview', 'packet', 'history'] as const).map((name) => (
            <TabsTrigger key={name} value={name}>
              {name === 'overview' ? (
                <FileText size={15} />
              ) : name === 'packet' ? (
                <FileCheck size={15} />
              ) : (
                <History size={15} />
              )}{' '}
              {name[0].toUpperCase() + name.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent className="detail-tab-content" value={tab}>
          {tab === 'overview' ? (
            <>
              <div className="tags">
                {card.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <h3>About the opportunity</h3>
              <p className="prewrap">
                {card.description ||
                  'Add job details when creating an opportunity to give your crew more context.'}
              </p>
              {card.feedback.length ? (
                <>
                  <h3>{card.state === 'lead' ? 'Scout notes' : 'Review notes'}</h3>
                  <ul className="feedback">
                    {card.feedback.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              <h3>Track the next step</h3>
              <p className="quiet">Update outcomes after you take action outside Pitchcrew.</p>
              <div className="tracking-actions">
                {transitions[card.state]
                  .filter(
                    (state) =>
                      ![
                        'drafting',
                        'in_review',
                        'agreed',
                        'awaiting_approval',
                        'submitted',
                        'shortlisted',
                      ].includes(state),
                  )
                  .map((state) => (
                    <Button
                      key={state}
                      disabled={working || Boolean(run)}
                      className="button small"
                      onClick={() =>
                        act(
                          `/cards/${card.id}/move`,
                          { state },
                          `Moved to ${stateLabels[state as CardState]}`,
                        )
                      }
                    >
                      {stateLabels[state]}
                    </Button>
                  ))}
              </div>
            </>
          ) : tab === 'packet' ? (
            card.packet ? (
              <>
                <div className="document-select">
                  {(['resume', 'coverLetter', 'formAnswers', 'note'] as const).map((name) => (
                    <Button
                      className={document === name ? 'selected' : ''}
                      key={name}
                      onClick={() => setDocument(name)}
                    >
                      {name === 'coverLetter'
                        ? 'Cover letter'
                        : name === 'formAnswers'
                          ? 'Form answers'
                          : name === 'resume'
                            ? 'Resume'
                            : 'Note'}
                    </Button>
                  ))}
                </div>
                <pre className="packet-document">{card.packet[document]}</pre>
                <h3>Evidence trail</h3>
                <p className="quiet">
                  Exact quotations checked against your profile. The reviewer also checks the full
                  packet.
                </p>
                {card.packet.claims.map((claim, i) => (
                  <div className="evidence" key={i}>
                    <ShieldCheck size={16} />
                    <div>
                      <p>{claim.claim}</p>
                      <small>{claim.source}</small>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <EmptyState
                title="Your story is still taking shape"
                description="Shortlist this opportunity and start the writer to create its application packet."
              />
            )
          ) : (
            <div className="detail-history">
              {data.events
                .filter(
                  (e) =>
                    e.entityId === card.id ||
                    (e.kind === 'run' && (e.data as { cardId?: string }).cardId === card.id),
                )
                .map((event) => (
                  <div key={event.id}>
                    <span className="history-dot" />
                    <div>
                      <strong>{event.message}</strong>
                      <p>
                        {event.actor} · {timeAgo(event.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Modal>
  );
}
export function RoleSettings({
  role,
  data,
  action,
  working,
  onClose,
}: {
  role: Role;
  data: Snapshot;
  action: Action;
  working: boolean;
  onClose: () => void;
}) {
  const [runtime, setRuntime] = useState(role.runtime);
  const [model, setModel] = useState(role.model);
  const [enabled, setEnabled] = useState(role.enabled);
  const [instructions, setInstructions] = useState(role.instructions);
  const [error, setError] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await action(
        `/roles/${role.id}`,
        'PUT',
        { runtime, model, enabled, instructions },
        `${role.name} settings saved`,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings.');
    }
  }
  return (
    <form className="form" onSubmit={(e) => void save(e)}>
      <p className="modal-intro">{role.description}</p>
      <label>
        Runtime
        <NativeSelect
          value={runtime}
          onChange={(e) => setRuntime(e.target.value as Role['runtime'])}
        >
          {data.runtimes.map((r) => (
            <NativeSelectOption value={r.id} key={r.id}>
              {runtimeLabels[r.id]}
              {r.available ? '' : ' (not installed)'}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      <label>
        Model <span className="optional">leave empty for the CLI default</span>
        <Input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          maxLength={100}
          placeholder="Your runtime’s model name"
          disabled={runtime === 'demo'}
        />
      </label>
      <label className="checkbox-label">
        <Checkbox checked={enabled} onCheckedChange={(value) => setEnabled(value === true)} />{' '}
        Enable this role
      </label>
      <label>
        Role instructions
        <Textarea
          rows={8}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={12000}
        />
      </label>
      <p className="quiet">
        Runs start when you choose an action on a card. Automatic schedules are coming later.
      </p>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <div className="form-footer">
        <Button className="button" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button className="button primary" disabled={working}>
          <Check size={15} /> Save settings
        </Button>
      </div>
    </form>
  );
}
export function ProfileView({
  data,
  action,
  working,
}: {
  data: Snapshot;
  action: Action;
  working: boolean;
}) {
  const [name, setName] = useState(data.profile[0]?.name ?? 'profile.md');
  const [content, setContent] = useState(
    data.profile[0]?.content ??
      '# Your name\n\n- Describe one experience or achievement you can substantiate.\n',
  );
  const [error, setError] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await action('/profile', 'PUT', { name, content }, 'Profile notes saved locally');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile.');
    }
  }
  return (
    <>
      <div className="callout">
        <span className="callout-icon">
          <ShieldCheck size={22} />
        </span>
        <div>
          <strong>Real experience. No invented achievements.</strong>
          <p>
            Your writer uses these notes, and your reviewer checks claims against them. Start with a
            name and factual bullet points.
          </p>
        </div>
      </div>
      <div className="profile-layout">
        <section className="profile-editor">
          <form onSubmit={(e) => void save(e)}>
            <div className="profile-editor-heading">
              <FileText size={18} />
              <label className="sr-only" htmlFor="profile-file">
                Profile filename
              </label>
              <Input
                id="profile-file"
                value={name}
                onChange={(e) => setName(e.target.value)}
                pattern="[a-zA-Z0-9_.\-]+\.md"
                maxLength={100}
                required
              />
              <Button className="button primary small" disabled={working}>
                Save notes
              </Button>
            </div>
            <label className="sr-only" htmlFor="profile-content">
              Profile Markdown
            </label>
            <Textarea
              id="profile-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck
              rows={19}
              maxLength={50000}
            />
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </section>
        <aside className="profile-aside">
          <h3>Your source files</h3>
          {data.profile.length ? (
            data.profile.map((file) => (
              <Button
                key={file.name}
                onClick={() => {
                  setName(file.name);
                  setContent(file.content);
                }}
                className={`profile-file ${name === file.name ? 'selected' : ''}`}
              >
                <FileText size={15} />
                {file.name}
              </Button>
            ))
          ) : (
            <p className="quiet">Save your first note to get started.</p>
          )}
          <Button
            className="text-button"
            onClick={() => {
              setName('new-note.md');
              setContent('# Project\n\n- Add a source-backed fact.\n');
            }}
          >
            <Plus size={14} /> New note
          </Button>
          <div className="profile-tip">
            <h3>What makes a good note?</h3>
            <p>
              Write specific facts about your work, projects, and skills. Include numbers only when
              you can verify them.
            </p>
            <p>
              The demo writer uses your bullet points verbatim. Real runtimes can tailor the
              surrounding prose.
            </p>
          </div>
        </aside>
      </div>
      <div className="data-location">
        <FolderOpen size={17} />
        <span>
          Stored on this device in <code>{data.dataDirectory}\profile</code>
        </span>
      </div>
    </>
  );
}
export function InboxView({
  data,
  action,
  working,
  onOpen,
}: {
  data: Snapshot;
  action: Action;
  working: boolean;
  onOpen: (id: string) => void;
}) {
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const approvals = data.approvals.filter((a) =>
    tab === 'pending'
      ? ['pending', 'approved'].includes(a.status)
      : ['rejected', 'consumed'].includes(a.status),
  );
  const act = (path: string, body?: unknown, success?: string) => {
    void action(path, 'POST', body, success).catch(() => {});
  };
  return (
    <>
      <div className="inbox-tabs">
        <Button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>
          For your review{' '}
          <span>
            {data.approvals.filter((a) => ['pending', 'approved'].includes(a.status)).length}
          </span>
        </Button>
        <Button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          Decision history
        </Button>
      </div>
      {approvals.length ? (
        <div className="approval-list">
          {approvals.map((approval) => {
            const card = data.cards.find((c) => c.id === approval.cardId)!;
            return (
              <section key={approval.id} className="approval-card">
                <div className="approval-heading">
                  <span className="approval-icon">
                    <Download size={21} />
                  </span>
                  <div>
                    <h2>Export application packet</h2>
                    <p>
                      {card.title} at {card.company}
                    </p>
                  </div>
                  <span className={`badge ${approval.status === 'consumed' ? 'success' : ''}`}>
                    {approval.status === 'pending'
                      ? 'Needs approval'
                      : approval.status === 'approved'
                        ? 'Approved'
                        : approval.status === 'consumed'
                          ? 'Exported'
                          : 'Rejected'}
                  </span>
                </div>
                <p className="approval-description">
                  Save the reviewed resume, cover letter, form answers, and note to your local
                  packet folder. You can then apply yourself.
                </p>
                <details className="approval-preview">
                  <summary>
                    <FileText size={15} /> Review the exact packet
                  </summary>
                  {Object.entries(approval.packet)
                    .filter(([key]) => key !== 'claims')
                    .map(([key, value]) => (
                      <div key={key}>
                        <h3>
                          {key === 'coverLetter'
                            ? 'Cover letter'
                            : key === 'formAnswers'
                              ? 'Form answers'
                              : key}
                        </h3>
                        <pre>{String(value)}</pre>
                      </div>
                    ))}
                </details>
                <div className="approval-footer">
                  <Button className="text-button" onClick={() => onOpen(card.id)}>
                    Open opportunity <ArrowRight size={14} />
                  </Button>
                  <span className="subtle">{timeAgo(approval.createdAt)}</span>
                  {approval.status === 'pending' ? (
                    <>
                      <Button
                        disabled={working}
                        className="button"
                        onClick={() =>
                          act(
                            `/approvals/${approval.id}/decide`,
                            { approved: false },
                            'Export rejected; packet returned for review',
                          )
                        }
                      >
                        <X size={15} /> Reject
                      </Button>
                      <Button
                        disabled={working}
                        className="button primary"
                        onClick={() =>
                          act(
                            `/approvals/${approval.id}/decide`,
                            { approved: true },
                            'Approved this exact packet for one local export',
                          )
                        }
                      >
                        <Check size={15} /> Approve export
                      </Button>
                    </>
                  ) : approval.status === 'approved' ? (
                    <Button
                      disabled={working}
                      className="button primary"
                      onClick={() => {
                        void action(
                          `/approvals/${approval.id}/export`,
                          'POST',
                          undefined,
                          (result) =>
                            `Packet exported to ${(result as { directory: string }).directory}`,
                        ).catch(() => {});
                      }}
                    >
                      <Download size={15} /> Export packet
                    </Button>
                  ) : null}
                </div>
                {approval.exportDirectory ? (
                  <p className="export-location">
                    <FolderOpen size={14} /> {approval.exportDirectory}
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={tab === 'pending' ? 'You’re all caught up' : 'Your decisions will appear here'}
          description={
            tab === 'pending'
              ? 'Once your reviewer agrees on a packet, request approval from its opportunity card.'
              : 'Approved exports and rejected requests are recorded in your workspace history.'
          }
        />
      )}
      <div className="info-note">
        <ShieldCheck size={17} />
        <p>
          Approval applies to this exact packet and can be used once. This MVP exports locally; it
          does not send emails or submit applications.
        </p>
      </div>
    </>
  );
}
