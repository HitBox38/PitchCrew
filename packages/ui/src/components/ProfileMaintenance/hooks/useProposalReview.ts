import { useRef, useState } from 'react';
import type { ProposalReviewProps } from '../types.ts';
import { saveReviewDecision } from '../api.ts';

export const useProposalReview = (props: ProposalReviewProps) => {
  const decide = async (approved: boolean) => {
    if (locked.current || props.working) return;
    locked.current = true;
    setProgress(
      approved
        ? proposal.documents.length
          ? 'Applying profile updates…'
          : 'Acknowledging source changes…'
        : 'Rejecting profile updates…',
    );
    props.onPendingChange(true);
    try {
      setError('');
      await saveReviewDecision(props.action, proposal, selected, verified, approved);
      const file = approved
        ? proposal.documents.find((item) => selected.includes(item.name))
        : undefined;
      props.onReviewed(file ? { name: file.name, content: file.content } : undefined, approved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not decide profile updates.');
    } finally {
      locked.current = false;
      setProgress('');
      props.onPendingChange(false);
    }
  };
  const toggle = (name: string) => {
    setSelected((names) =>
      names.includes(name) ? names.filter((item) => item !== name) : [...names, name],
    );
  };

  const { proposal } = props;
  const [selected, setSelected] = useState(
    proposal.selected ??
      proposal.documents.filter((file) => file.status !== 'conflict').map((file) => file.name),
  );
  const [verified, setVerified] = useState(proposal.verifiedFacts ?? false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const pending = !!progress;
  const locked = useRef(false);
  const active = props.data.runs.some((run) => run.status === 'running');
  return {
    selected,
    verified,
    setVerified,
    error,
    pending,
    progress,
    active,
    toggle,
    decide: (approved: boolean) => props.requestImport(() => void decide(approved)),
  };
};
