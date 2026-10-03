import type { ProfileMaintenanceProposal } from '@pitchcrew/core';
import { useState } from 'react';
import type { ProfileSourcesProps } from '../../ProfileSources/types.ts';

export function useProposalReview(
  props: ProfileSourcesProps & { proposal: ProfileMaintenanceProposal },
) {
  const { proposal } = props;
  const [selected, setSelected] = useState(
    proposal.selected ??
      proposal.documents.filter((file) => file.status !== 'conflict').map((file) => file.name),
  );
  const [verified, setVerified] = useState(proposal.verifiedFacts ?? false);
  const [error, setError] = useState('');
  const active = props.data.runs.some((run) => run.status === 'running');
  async function decide(approved: boolean) {
    try {
      setError('');
      await props.action(
        `/profile/proposals/${proposal.id}/decide`,
        'POST',
        {
          approved,
          names: selected,
          verifiedFacts: verified,
          snapshotDigest: proposal.snapshotDigest,
        },
        approved ? 'Verified profile updates applied' : 'Profile updates rejected',
      );
      if (approved) {
        const file = proposal.documents.find((item) => selected.includes(item.name));
        if (file) props.openImported({ name: file.name, content: file.content });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not decide profile updates.');
    }
  }
  function toggle(name: string) {
    setSelected((names) =>
      names.includes(name) ? names.filter((item) => item !== name) : [...names, name],
    );
  }
  return {
    selected,
    verified,
    setVerified,
    error,
    active,
    toggle,
    decide: (approved: boolean) => props.requestImport(() => void decide(approved)),
  };
}
