import type { ProfileMaintenanceProposal, ProfileSource } from '@pitchcrew/core';
import { readProfile } from '@pitchcrew/packet';
import { z } from 'zod';
import { digest } from '../../profile-sources/helpers.ts';
import type { CrewContext, RunCapability } from '../types.ts';

export function visibleProposal(proposal: ProfileMaintenanceProposal) {
  const { baseSources: _sources, baseProfile: _profile, ...visible } = proposal;
  return visible;
}

export function proposalDigest(proposal: ProfileMaintenanceProposal) {
  return digest(
    JSON.stringify({
      source: proposal.source,
      baseSources: proposal.baseSources,
      baseProfile: proposal.baseProfile,
      documents: proposal.documents,
      missing: proposal.missing,
      restored: proposal.restored,
      observation: proposal.observation,
      evidence: proposal.evidence,
      generated: proposal.generated,
    }),
  );
}

export async function readProjectFile(
  context: CrewContext,
  capability: RunCapability,
  source: ProfileSource,
  revision: string,
  path: string,
) {
  const input = source.input;
  if (input.provider !== 'github' || source.mode !== 'project')
    throw new Error('Choose a GitHub project watch.');
  if (input.path && path !== input.path && !path.startsWith(input.path + '/'))
    throw new Error('Choose a file inside the watched project folder.');
  const [owner, repo] = input.repository.split('/');
  const result = await context.connectors.call(
    'github_read_file',
    { owner, repo, path, ref: revision },
    context.controllers.get(capability.runId)!.signal,
  );
  const content = z
    .string()
    .max(50000)
    .refine((text) => !text.includes('\0'))
    .parse(result.text);
  return {
    path,
    content,
    revision,
    url: `https://github.com/${input.repository}/blob/${revision}/${path.split('/').map(encodeURIComponent).join('/')}`,
  };
}

export const projectFilePath = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (path) =>
      !path.startsWith('/') &&
      !path.includes('\\') &&
      !path.split('/').some((part) => part === '.' || part === '..'),
  );

export async function projectNote(
  context: CrewContext,
  capability: RunCapability,
  proposal: ProfileMaintenanceProposal,
  data: Record<string, unknown>,
  authorize: () => Promise<void>,
) {
  const input = z
    .object({
      proposalId: z.uuid(),
      name: z
        .string()
        .regex(/^[\w.-]+\.md$/)
        .refine((name) => !name.includes('..')),
      content: z
        .string()
        .min(1)
        .max(50000)
        .refine((text) => !text.includes('\0')),
      paths: z.array(projectFilePath).min(1).max(5),
    })
    .strict()
    .parse(data);
  if (proposal.status !== 'pending' || !proposal.observation)
    throw new Error('Choose a pending project observation.');
  if (proposal.documents.length >= 3)
    throw new Error('Three proposed project notes maximum per observation.');
  const evidence = [];
  for (const path of [...new Set(input.paths)])
    evidence.push(
      await readProjectFile(
        context,
        capability,
        proposal.source,
        proposal.observation.current,
        path,
      ),
    );
  await authorize();
  const notes = await readProfile(context.directory);
  if (
    digest(
      JSON.stringify(notes.map((note) => ({ name: note.name, digest: digest(note.content) }))),
    ) !== digest(JSON.stringify(proposal.baseProfile))
  )
    throw new Error('Profile notes changed since detection. Detect again.');
  const before = notes.find((note) => note.name === input.name)?.content ?? null;
  if (
    context.board.get<ProfileMaintenanceProposal>('profile_proposal', proposal.id)
      .snapshotDigest !== proposal.snapshotDigest
  )
    throw new Error('Another note was proposed concurrently. Read the observation again.');
  const updated: ProfileMaintenanceProposal = {
    ...proposal,
    generated: true,
    evidence: [...(proposal.evidence ?? []), ...evidence],
    documents: [
      ...proposal.documents,
      {
        key: input.name,
        name: input.name,
        content: input.content,
        before,
        digest: digest(input.content),
        path: input.paths.join(', '),
        url: evidence[0]!.url,
        revision: proposal.observation.current,
        status: before === null ? 'new' : 'conflict',
      },
    ],
  };
  if (
    updated.documents.some(
      (file, index) => updated.documents.findIndex((other) => other.name === file.name) !== index,
    )
  )
    throw new Error('Each note can be proposed once per observation.');
  updated.snapshotDigest = proposalDigest(updated);
  context.board.record(
    'profile_proposal',
    updated,
    capability.roleId,
    'Proposed a project profile note for factual verification',
  );
  return { proposal: visibleProposal(updated) };
}
