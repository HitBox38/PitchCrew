import type {
  ProfileMaintenanceProposal,
  ProfileSource,
  ProfileSourcePreview,
  Role,
  Run,
} from '@pitchcrew/core';
import { readProfile } from '@pitchcrew/packet';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  projectFilePath,
  projectNote,
  proposalDigest,
  readProjectFile,
  visibleProposal,
} from './profile-project.ts';
import { digest } from '../../profile-sources/helpers.ts';
import type { CrewContext, RunCapability } from '../types.ts';

export async function profileAction(
  this: CrewContext,
  capability: RunCapability,
  token: string,
  action: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const authorize = (source?: ProfileSource) => {
    const role = this.board.get<Role>('role', capability.roleId);
    const signal = this.controllers.get(capability.runId)?.signal;
    if (
      this.closing ||
      this.capabilities.get(token) !== capability ||
      !signal ||
      signal.aborted ||
      this.board.get<Run>('run', capability.runId).status !== 'running' ||
      !role.enabled ||
      role.capabilities?.maintainProfile !== true
    )
      throw new Error('Profile maintenance is disabled or this run has ended.');
    if (source) {
      if (
        !source.watching ||
        role.capabilities?.[source.input.provider === 'github' ? 'github' : 'drive'] !== true
      )
        throw new Error('Source watching and the matching connector capability must be enabled.');
      const account = this.connectors
        .status()
        .find((item) => item.id === (source.input.provider === 'github' ? 'github' : 'google'));
      if (
        !account?.connected ||
        (source.input.provider === 'drive' && !account.services.includes('drive'))
      )
        throw new Error('The profile source account is disconnected.');
    }
    return role;
  };
  const payload = z.record(z.string(), z.unknown()).parse(data.input ?? {});
  const role = authorize();
  const sources = await this.profileSources.list();
  if (action === 'watched_profile_sources')
    return {
      sources: sources
        .filter(
          (source) =>
            source.watching &&
            role.capabilities?.[source.input.provider === 'github' ? 'github' : 'drive'] === true,
        )
        .map(({ id, label, input, files, mode, revision }) => ({
          id,
          label,
          provider: input.provider,
          mode,
          revision,
          files: files.map(({ path, revision }) => ({ path, revision })),
        })),
    };
  if (action === 'read_project_watch_file' || action === 'propose_profile_note') {
    const proposal = this.board.get<ProfileMaintenanceProposal>(
      'profile_proposal',
      z.uuid().parse(payload.proposalId),
    );
    const watched = sources.find((item) => item.id === proposal.source.id);
    if (!watched || !proposal.observation) throw new Error('Project watch not found.');
    authorize(watched);
    if (digest(JSON.stringify(watched.input)) !== digest(JSON.stringify(proposal.source.input)))
      throw new Error('The project watch changed since observation. Detect again.');
    if (action === 'propose_profile_note')
      return projectNote(this, capability, proposal, payload, async () => {
        const current = (await this.profileSources.list()).find((item) => item.id === watched.id);
        if (!current || digest(JSON.stringify(current)) !== digest(JSON.stringify(watched)))
          throw new Error('Project watch changed during the read.');
        authorize(current);
        if (this.profileWriting) throw new Error('Profile update is in progress.');
      });
    const input = z.object({ proposalId: z.uuid(), path: projectFilePath }).strict().parse(payload);
    const file = await readProjectFile(
      this,
      capability,
      watched,
      proposal.observation.current,
      input.path,
    );
    const current = (await this.profileSources.list()).find((item) => item.id === watched.id);
    if (!current || digest(JSON.stringify(current)) !== digest(JSON.stringify(watched)))
      throw new Error('Project watch changed during the read.');
    authorize(current);
    return { file };
  }
  const { sourceId } = z
    .object({ sourceId: z.string().regex(/^[a-f0-9]{24}$/) })
    .strict()
    .parse(payload);
  const source = sources.find((item) => item.id === sourceId);
  if (!source) throw new Error('Profile source not found.');
  authorize(source);
  const all = this.board.list<ProfileMaintenanceProposal>('profile_proposal');
  const existing = all.find(
    (p) => p.source.id === sourceId && ['pending', 'applying'].includes(p.status),
  );
  if (existing) return { proposal: visibleProposal(existing), detected: false };
  if (all.filter((p) => p.runId === capability.runId).length >= 3)
    throw new Error('Three profile proposals maximum per run.');
  const revision = this.profileRevision;
  let observation: ProfileMaintenanceProposal['observation'];
  let preview: Pick<ProfileSourcePreview, 'source' | 'files' | 'missing'>;
  if (source.mode === 'project' && source.input.provider === 'github') {
    const [owner, repo] = source.input.repository.split('/');
    const result = await this.connectors.call(
      'github_get_revision',
      { owner, repo, ref: source.input.ref },
      this.controllers.get(capability.runId)!.signal,
    );
    const current = z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .parse(result.sha);
    if (current !== source.revision) observation = { previous: source.revision!, current };
    preview = { source, files: [], missing: [] };
  } else
    preview = await this.profileSources.preview(
      source.input,
      this.controllers.get(capability.runId)!.signal,
      true,
    );
  const currentSources = await this.profileSources.list();
  const currentSource = currentSources.find((item) => item.id === sourceId);
  if (!currentSource || digest(JSON.stringify(sources)) !== digest(JSON.stringify(currentSources)))
    throw new Error('Profile source settings changed during detection.');
  authorize(currentSource);
  if (this.profileWriting || revision !== this.profileRevision)
    throw new Error('Profile notes changed during detection. Try again.');
  const latest = this.board.list<ProfileMaintenanceProposal>('profile_proposal');
  const pending = latest.find(
    (p) => p.source.id === sourceId && ['pending', 'applying'].includes(p.status),
  );
  if (pending) return { proposal: visibleProposal(pending), detected: false };
  if (latest.filter((p) => p.runId === capability.runId).length >= 3)
    throw new Error('Three profile proposals maximum per run.');
  const notes = await readProfile(this.directory);
  authorize(currentSource);
  const changes = preview.files
    .filter((file) => file.status !== 'unchanged')
    .map((file) => ({
      ...file,
      before: notes.find((note) => note.name === file.name)?.content ?? null,
    }));
  const missing = preview.missing.filter((path) => !source.missingFiles?.includes(path));
  const restored = (source.missingFiles ?? []).filter((path) => !preview.missing.includes(path));
  if (!changes.length && !missing.length && !restored.length && !observation)
    return { detected: false, proposal: null };
  const proposal: ProfileMaintenanceProposal = {
    id: randomUUID(),
    roleId: capability.roleId,
    runId: capability.runId,
    source: preview.source,
    baseSources: sources,
    baseProfile: notes.map((file) => ({ name: file.name, digest: digest(file.content) })),
    documents: changes,
    missing,
    restored,
    observation,
    snapshotDigest: '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  proposal.snapshotDigest = proposalDigest(proposal);
  this.board.record(
    'profile_proposal',
    proposal,
    capability.roleId,
    `Proposed profile updates from ${source.label}`,
  );
  const run = this.board.get<Run>('run', capability.runId);
  this.addMessage(
    run.threadId ?? 'crew',
    capability.roleId,
    run.threadId ?? 'crew',
    `Profile changes are ready to review for ${source.label}. Review exact documents and verify personal facts on Profile before applying. Removed documents are kept.`,
    capability.cardId,
    capability.runId,
    undefined,
    'attention',
  );
  return { detected: true, proposal: visibleProposal(proposal) };
}
