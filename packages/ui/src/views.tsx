import { capabilityLabels } from './agent-capabilities.ts';
import { Textarea } from './components/ui/textarea.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select.tsx';
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
import { transitions } from '@pitchcrew/core/states';
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
        'Job added',
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the job.');
    }
  }
  return (
    <Modal title="Add a job post" onClose={onClose}>
      <p className="modal-intro">
        Scout works from the description, so paste it in if you have it.
      </p>
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
            placeholder="Paste the full listing"
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
          <Button type="submit" className="button primary" disabled={working}>
            {working ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Add job
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
    <Modal title="Job" onClose={onClose} drawer>
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
                  act(`/cards/${card.id}/move`, { state: 'shortlisted' }, 'Shortlisted')
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
                    'Approval requested; it’s in your inbox',
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
        <TabsList className="detail-tabs" aria-label="Job sections">
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
              <h3>Description</h3>
              <p className="prewrap">{card.description || 'No description was added.'}</p>
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
              <h3>Outcome</h3>
              <p className="quiet">Record what happened after you applied.</p>
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
                <h3>Sources</h3>
                <p className="quiet">
                  Each claim quotes your profile notes word for word. Reviewer reads the whole
                  packet as well.
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
                title="No packet yet"
                description="Shortlist this job, then run Writer to draft one."
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
  const [capabilities, setCapabilities] = useState(
    role.capabilities ?? { messageAgents: true, invokeAgents: true, manageWorkflow: true },
  );
  const [error, setError] = useState('');
  const runtimeItems = data.runtimes.map((r) => ({
    value: r.id,
    label: `${runtimeLabels[r.id]}${r.available ? '' : ' (not installed)'}`,
  }));
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await action(
        `/roles/${role.id}`,
        'PUT',
        { runtime, model, enabled, instructions, capabilities },
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
      <div className="field">
        <label htmlFor={`${role.id}-runtime`}>Runtime</label>
        <Select
          value={runtime}
          onValueChange={(value: Role['runtime'] | null) => {
            if (value) setRuntime(value);
          }}
          items={runtimeItems}
        >
          <SelectTrigger id={`${role.id}-runtime`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} sideOffset={6}>
            {runtimeItems.map((item) => (
              <SelectItem value={item.value} key={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
        <Checkbox checked={enabled} onCheckedChange={(checked) => setEnabled(checked)} /> Enable
        this role
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
      <fieldset className="role-capabilities">
        <legend>Agent capabilities</legend>
        {Object.entries(capabilityLabels).map(([key, label]) => (
          <label className="checkbox-label" key={key}>
            <Checkbox
              checked={capabilities[key as keyof typeof capabilities]}
              onCheckedChange={(checked) =>
                setCapabilities((current) => ({ ...current, [key]: checked }))
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      <p className="quiet">
        Crew follow-ups run after the current turn finishes, with at most six per chain. Agents
        propose instruction and capability changes for you to apply in chat.
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
        <Button type="submit" className="button primary" disabled={working}>
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
      await action('/profile', 'PUT', { name, content }, 'Saved');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile.');
    }
  }
  return (
    <>
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
              <Button type="submit" className="button primary small" disabled={working}>
                Save
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
          <h3>Notes</h3>
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
            <p className="quiet">No notes saved yet.</p>
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
            <h3>Writing useful notes</h3>
            <p>
              One fact per bullet: what you built, for whom, and what changed. Only include numbers
              you could back up in an interview.
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
          Stored in{' '}
          <code>
            {data.dataDirectory}
            {data.dataDirectory.includes('\\') ? '\\' : '/'}profile
          </code>
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
          Waiting{' '}
          <span>
            {data.approvals.filter((a) => ['pending', 'approved'].includes(a.status)).length}
          </span>
        </Button>
        <Button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          Decided
        </Button>
      </div>
      {approvals.length ? (
        <div className="approval-list">
          {approvals.map((approval) => {
            const card = data.cards.find((c) => c.id === approval.cardId)!;
            return (
              <section key={approval.id} className="approval-card">
                <div className="approval-heading">
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
                    <FileText size={15} /> Show the packet
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
                    Open job <ArrowRight size={14} />
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
          title={tab === 'pending' ? 'Nothing to approve' : 'No decisions yet'}
          description={
            tab === 'pending'
              ? 'When Reviewer agrees on a packet, request approval from the job’s card.'
              : 'Approved exports and rejections are kept here.'
          }
        />
      )}
      <p className="info-note">
        An approval is bound to one exact packet and works for a single export. Pitchcrew only
        writes files to this machine; it never emails or submits anything for you.
      </p>
    </>
  );
}
