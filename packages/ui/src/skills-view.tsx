import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BookOpen, Check, LoaderCircle, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { Role, RoleId, Skill, SkillPreview, Snapshot } from '@pitchcrew/core';
import {
  baseSkills,
  baseSkillUrl,
  skillContentLimit,
  type BaseSkill,
} from '@pitchcrew/core/base-skills';
import { api } from './api.ts';
import type { Action } from './App.tsx';
import { EmptyState, Modal, RoleAvatar, timeAgo } from './components.tsx';
import { Button } from './components/ui/button.tsx';
import { Checkbox } from './components/ui/checkbox.tsx';
import { Input } from './components/ui/input.tsx';
import { Textarea } from './components/ui/textarea.tsx';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './components/ui/sheet.tsx';

type SkillFilter = 'all' | 'shared' | RoleId;
function assignment(skill: Skill, roles: Role[]) {
  return skill.scope === 'all'
    ? 'All agents'
    : roles
        .filter((role) => skill.roleIds.includes(role.id))
        .map((role) => role.name)
        .join(', ');
}
export function SkillsView({
  data,
  action,
  working,
  filter,
  onFilter,
}: {
  data: Snapshot;
  action: Action;
  working: boolean;
  filter: SkillFilter;
  onFilter: (filter: SkillFilter) => void;
}) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Skill | 'new' | 'import' | null>(null);
  const [starter, setStarter] = useState<BaseSkill | null>(null);
  const [deleting, setDeleting] = useState<Skill | null>(null);
  const [error, setError] = useState('');
  const skills = data.skills.filter(
    (skill) =>
      (filter === 'all' ||
        (filter === 'shared'
          ? skill.scope === 'all'
          : skill.scope === 'all' || skill.roleIds.includes(filter))) &&
      `${skill.name} ${skill.description} ${skill.content}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const filters: { value: SkillFilter; label: string }[] = [
    { value: 'all', label: 'All skills' },
    { value: 'shared', label: 'Shared' },
    ...data.roles.map((role) => ({ value: role.id, label: role.name })),
  ];
  async function remove() {
    if (!deleting) return;
    try {
      await action(`/skills/${deleting.id}`, 'DELETE', undefined, 'Deleted skill');
      setDeleting(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete skill.');
    }
  }
  return (
    <section className="skills-view" aria-label="Skill library">
      <div className="skills-toolbar">
        <div className="search-input">
          <Search size={15} />
          <Input
            aria-label="Search skills"
            placeholder="Search skills"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="skill-actions">
          <Button
            className="button"
            onClick={() => {
              setStarter(null);
              setEditing('import');
            }}
            disabled={working}
          >
            Import from skills.sh
          </Button>
          <Button className="button primary" onClick={() => setEditing('new')} disabled={working}>
            <Plus size={16} /> Add skill
          </Button>
        </div>
      </div>
      <fieldset className="skill-filters" aria-label="Filter skills by agent">
        {filters.map((item) => (
          <Button
            key={item.value}
            className={`button small ${filter === item.value ? 'active' : ''}`}
            aria-pressed={filter === item.value}
            onClick={() => onFilter(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </fieldset>
      <p className="quiet skills-guidance">
        Skills are reusable Markdown instructions. Agent views include shared skills. Updates apply
        to the next chat or job run.
      </p>
      {skills.length ? (
        <ul className="skill-library">
          {skills.map((skill) => (
            <li className="skill-row" key={skill.id}>
              <BookOpen size={20} className="skill-mark" aria-hidden="true" />
              <div className="skill-summary">
                <h2>{skill.name}</h2>
                {skill.description ? <p>{skill.description}</p> : null}
                <div className="skill-meta">
                  <span className="badge">{assignment(skill, data.roles)}</span>
                  {skill.source ? <span className="badge">skills.sh</span> : null}
                  <span>Updated {timeAgo(skill.updatedAt)}</span>
                </div>
              </div>
              <div className="skill-actions">
                <Button
                  className="button small"
                  aria-label={`Edit ${skill.name}`}
                  onClick={() => setEditing(skill)}
                  disabled={working}
                >
                  <Pencil size={14} /> Edit
                </Button>
                <Button
                  className="icon-button"
                  aria-label={`Delete ${skill.name}`}
                  disabled={working}
                  onClick={() => {
                    setError('');
                    setDeleting(skill);
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={data.skills.length ? 'No matching skills' : 'Teach your crew a skill'}
          description={
            data.skills.length
              ? 'Try another search or agent filter.'
              : 'Add a writing style, a research method, or a review checklist. Share it with every agent or choose who uses it.'
          }
        />
      )}
      <details className="starter-skills" open={!data.skills.length || undefined}>
        <summary>
          Starter skills <span className="quiet">{baseSkills.length} suggestions</span>
        </summary>
        <p className="quiet">
          A curated starting list for applications, research and writing. Load a skill, review its
          instructions, then choose which agents use it.
        </p>
        <ul className="starter-skill-library">
          {baseSkills
            .filter((item) =>
              `${item.name} ${item.description} ${item.source}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((item) => (
              <li className="starter-skill" key={item.name}>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <span className="quiet skill-source">{item.source}</span>
                  {item.note ? <p className="quiet">{item.note}</p> : null}
                </div>
                <Button
                  className="button small"
                  aria-label={
                    item.unavailable ? `${item.name} source unavailable` : `Import ${item.name}`
                  }
                  disabled={working || item.unavailable}
                  onClick={() => {
                    setStarter(item);
                    setEditing('import');
                  }}
                >
                  {item.unavailable ? 'Source unavailable' : 'Import'}
                </Button>
              </li>
            ))}
        </ul>
      </details>
      {editing ? (
        <SkillEditor
          key={
            typeof editing === 'string'
              ? editing === 'import'
                ? (starter?.name ?? editing)
                : editing
              : editing.id
          }
          skill={typeof editing === 'string' ? null : editing}
          importing={editing === 'import'}
          starter={editing === 'import' ? starter : null}
          roles={data.roles}
          initialRole={filter !== 'all' && filter !== 'shared' ? filter : null}
          action={action}
          working={working}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <Modal
          title="Delete skill"
          onClose={() => {
            if (!working) setDeleting(null);
          }}
        >
          <p>
            Delete <strong>{deleting.name}</strong> for {assignment(deleting, data.roles)}? Future
            runs will stop using it. Active runs keep their current skills.
          </p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="form-footer">
            <Button className="button" disabled={working} onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button className="button danger" disabled={working} onClick={() => void remove()}>
              <Trash2 size={15} /> Delete skill
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
function SkillEditor({
  skill,
  roles,
  initialRole,
  importing,
  starter,
  action,
  working,
  onClose,
}: {
  skill: Skill | null;
  roles: Role[];
  initialRole: RoleId | null;
  importing: boolean;
  starter: BaseSkill | null;
  action: Action;
  working: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(skill?.name ?? starter?.name ?? '');
  const [description, setDescription] = useState(skill?.description ?? starter?.description ?? '');
  const [content, setContent] = useState(skill?.content ?? '');
  const [scope, setScope] = useState<'all' | 'roles'>(
    skill?.scope ?? (initialRole ? 'roles' : 'all'),
  );
  const [roleIds, setRoleIds] = useState<RoleId[]>(
    skill?.roleIds ?? (initialRole ? [initialRole] : []),
  );
  const [error, setError] = useState('');
  const [source, setSource] = useState(skill?.source);
  const [url, setUrl] = useState(skill?.source?.url ?? (starter ? baseSkillUrl(starter) : ''));
  const [loading, setLoading] = useState(false);
  const importRequest = useRef<AbortController | null>(null);
  useEffect(() => () => importRequest.current?.abort(), []);
  async function loadSkill() {
    importRequest.current?.abort();
    const controller = new AbortController();
    importRequest.current = controller;
    setLoading(true);
    setError('');
    try {
      const preview = await api<SkillPreview>(
        '/skills/preview',
        'POST',
        { url, refresh: !!skill },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setName(preview.name);
      setDescription(preview.description);
      setContent(preview.content);
      setSource(preview.source);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : 'Could not load skill.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (loading || working) return;
    setError('');
    if (scope === 'roles' && !roleIds.length) {
      setError('Choose at least one agent.');
      return;
    }
    try {
      await action(
        skill ? `/skills/${skill.id}` : '/skills',
        skill ? 'PUT' : 'POST',
        {
          name,
          description,
          content,
          scope,
          roleIds: scope === 'all' ? [] : roleIds,
          ...(source ? { source } : {}),
        },
        skill ? 'Updated skill' : 'Added skill',
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save skill.');
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !working) onClose();
      }}
    >
      <SheetContent className="role-settings-panel skill-editor-panel" showCloseButton={false}>
        <header className="role-settings-heading">
          <BookOpen size={26} />
          <div>
            <SheetTitle>
              {skill ? 'Edit skill' : importing ? 'Import from skills.sh' : 'Add skill'}
            </SheetTitle>
            <SheetDescription>Describe a reusable way of working for your agents.</SheetDescription>
          </div>
          <Button
            className="icon-button"
            aria-label="Close skill editor"
            disabled={working}
            onClick={onClose}
          >
            <X size={20} />
          </Button>
        </header>
        <form className="form role-settings-form" onSubmit={(event) => void save(event)}>
          <div className="role-settings-body">
            {importing || skill?.source ? (
              <section className="role-settings-section" aria-labelledby="skill-import-heading">
                <h3 id="skill-import-heading">Import from skills.sh</h3>
                <label htmlFor="skill-url">Skill URL</label>
                <Input
                  id="skill-url"
                  type="url"
                  maxLength={500}
                  placeholder="https://skills.sh/owner/repository/skill-name"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading || working}
                />
                <Button
                  className="button"
                  onClick={() => void loadSkill()}
                  disabled={loading || working || !url.trim()}
                >
                  {loading ? <LoaderCircle className="spin" size={15} /> : <BookOpen size={15} />}{' '}
                  {skill ? 'Load latest instructions' : 'Load skill'}
                </Button>
                <p className="quiet">
                  Imports public GitHub-backed SKILL.md instructions. Supporting scripts and files
                  are not included. Review the instructions before adding them to your crew.
                </p>
                {starter?.note ? <p className="quiet">{starter.note}</p> : null}
              </section>
            ) : null}
            <section className="role-settings-section" aria-label="Skill details">
              <label htmlFor="skill-name">Name</label>
              <Input
                id="skill-name"
                required
                maxLength={80}
                placeholder="e.g. Clear application writing"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <label htmlFor="skill-description">
                Description <span className="optional">optional</span>
              </label>
              <Input
                id="skill-description"
                maxLength={500}
                placeholder="When should an agent use this skill?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </section>
            <section className="role-settings-section" aria-labelledby="skill-assignment-heading">
              <h3 id="skill-assignment-heading">Who uses this skill?</h3>
              <fieldset className="skill-filters" aria-label="Skill scope">
                <Button
                  className={`button small ${scope === 'all' ? 'active' : ''}`}
                  aria-pressed={scope === 'all'}
                  onClick={() => setScope('all')}
                >
                  All agents
                </Button>
                <Button
                  className={`button small ${scope === 'roles' ? 'active' : ''}`}
                  aria-pressed={scope === 'roles'}
                  onClick={() => setScope('roles')}
                >
                  Choose agents
                </Button>
              </fieldset>
              {scope === 'roles' ? (
                <fieldset className="role-settings-capabilities">
                  <legend>Assigned agents</legend>
                  {roles.map((role) => (
                    <label className="checkbox-label" key={role.id}>
                      <Checkbox
                        checked={roleIds.includes(role.id)}
                        onCheckedChange={(checked) =>
                          setRoleIds((current) =>
                            checked
                              ? [...current, role.id]
                              : current.filter((id) => id !== role.id),
                          )
                        }
                      />
                      <RoleAvatar agentRole={role.id} size="small" />
                      {role.name}
                    </label>
                  ))}
                </fieldset>
              ) : (
                <p className="quiet">Scout, Writer, and Reviewer will all receive this skill.</p>
              )}
            </section>
            <section className="role-settings-section" aria-labelledby="skill-content-heading">
              <h3 id="skill-content-heading">
                <label htmlFor="skill-content">Instructions</label>
              </h3>
              <p className="quiet">
                Write in Markdown. Explain when to use the skill and the steps to follow.
              </p>
              <Textarea
                id="skill-content"
                className="skill-markdown"
                rows={14}
                required
                maxLength={skillContentLimit}
                placeholder={
                  '# Clear application writing\n\nUse when drafting an application.\n\n- Lead with relevant experience.\n- Keep sentences direct and specific.\n- Support every claim with a profile quotation.'
                }
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              {source ? (
                <p className="quiet skill-source">
                  Based on {source.url}
                  <br />
                  Source file: {source.path}
                </p>
              ) : null}
              <span className="quiet">
                {content.length.toLocaleString()} / {skillContentLimit.toLocaleString()} characters
              </span>
            </section>
          </div>
          <footer className="role-settings-footer">
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="role-settings-actions">
              <Button className="button" disabled={working} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="button primary" disabled={working || loading}>
                {working ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}
                {skill ? 'Save changes' : 'Add skill'}
              </Button>
            </div>
          </footer>
        </form>
      </SheetContent>
    </Sheet>
  );
}
