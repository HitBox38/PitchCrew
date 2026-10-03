import type { ProfileMaintenanceProposal } from '@pitchcrew/core';
import { z } from 'zod';
import type { CrewContext } from '../crew/types.ts';
import { changeProfile } from './mutation.ts';

export async function decideProfileProposal(context: CrewContext, id: string, data: unknown) {
  const input = z
    .object({
      approved: z.boolean(),
      snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
      names: z.array(z.string()).max(100).default([]),
      verifiedFacts: z.boolean().default(false),
    })
    .strict()
    .parse(data);
  const proposal = context.board.get<ProfileMaintenanceProposal>('profile_proposal', id);
  if (input.snapshotDigest !== proposal.snapshotDigest)
    throw new Error('The proposal changed. Review the current snapshot again.');
  if (!['pending', 'applying'].includes(proposal.status))
    throw new Error('This profile proposal was already decided.');
  if (!input.approved) {
    if (context.profileWriting) throw new Error('Wait for the current profile update to finish.');
    if (proposal.status === 'applying')
      throw new Error('An approved update needs to finish applying. Retry it when runs are idle.');
    const rejected: ProfileMaintenanceProposal = {
      ...proposal,
      status: 'rejected',
      decidedAt: new Date().toISOString(),
    };
    context.board.record('profile_proposal', rejected, 'user', 'Rejected profile updates');
    return rejected;
  }
  if (!input.verifiedFacts)
    throw new Error(
      'Verify the selected documents contain supported personal facts before applying.',
    );
  if (
    new Set(input.names).size !== input.names.length ||
    input.names.some((name) => !proposal.documents.some((file) => file.name === name))
  )
    throw new Error('Select only proposed files, once each.');
  if (
    proposal.status === 'applying' &&
    JSON.stringify(input.names) !== JSON.stringify(proposal.selected)
  )
    throw new Error('Retry the exact previously approved selection.');
  return changeProfile(context, async () => {
    const source = (await context.profileSources.list()).find(
      (item) => item.id === proposal.source.id,
    );
    if (!source?.watching) throw new Error('This source is no longer watched.');
    const account = context.connectors
      .status()
      .find((item) => item.id === (source.input.provider === 'github' ? 'github' : 'google'));
    if (
      !account?.connected ||
      (source.input.provider === 'drive' && !account.services.includes('drive'))
    )
      throw new Error('Reconnect the source account before applying.');
    await context.profileSources.commitMaintenance(
      proposal,
      input.names,
      proposal.status === 'applying',
      true,
    );
    const applying: ProfileMaintenanceProposal = {
      ...proposal,
      status: 'applying',
      selected: input.names,
      verifiedFacts: true,
      decidedAt: proposal.decidedAt ?? new Date().toISOString(),
    };
    // Save the user decision first; an interrupted write can only retry this exact snapshot.
    context.board.record(
      'profile_proposal',
      applying,
      'user',
      'Approved verified profile snapshot',
    );
    await context.profileSources.commitMaintenance(
      applying,
      input.names,
      proposal.status === 'applying',
    );
    const applied: ProfileMaintenanceProposal = { ...applying, status: 'applied' };
    context.board.record('profile_proposal', applied, 'user', 'Applied approved profile snapshot');
    return applied;
  });
}
