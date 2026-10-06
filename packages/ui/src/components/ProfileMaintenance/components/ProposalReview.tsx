import type { ProfileMaintenanceProposal } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import type { ProfileSourcesProps } from '../../ProfileSources/types.ts';
import { useProposalReview } from '../hooks/useProposalReview.ts';
import { ProposalDocuments } from './ProposalDocuments.tsx';

export function ProposalReview(
  props: ProfileSourcesProps & { proposal: ProfileMaintenanceProposal },
) {
  const c = useProposalReview(props);
  const { proposal } = props;
  return (
    <article className="approval-card form grid gap-3 text-sm">
      <h4 className="font-serif text-lg font-semibold">{proposal.source.label}</h4>
      {proposal.observation ? (
        <p>
          Project changed from {proposal.observation.previous.slice(0, 8)} to{' '}
          {proposal.observation.current.slice(0, 8)}. A commit establishes a project change; verify
          your own contribution before adding it to your profile.
        </p>
      ) : null}
      {proposal.generated ? (
        <p>
          Agent-written notes require your factual verification. Review the pinned evidence and any
          uncertain claims.
        </p>
      ) : null}
      <ProposalDocuments
        proposal={proposal}
        selected={c.selected}
        toggle={c.toggle}
        disabled={props.working || proposal.status === 'applying'}
      />
      {proposal.missing.length ? (
        <p>Removed upstream; local notes will be kept: {proposal.missing.join(', ')}</p>
      ) : null}
      {proposal.restored?.length ? <p>Returned upstream: {proposal.restored.join(', ')}</p> : null}
      <label className="checkbox-label items-start">
        <Checkbox
          checked={c.verified}
          disabled={props.working || proposal.status === 'applying'}
          onCheckedChange={c.setVerified}
        />
        {proposal.documents.length
          ? 'I reviewed the selected documents and verified their personal facts. They may be used as resume evidence.'
          : 'I reviewed this observation. Keep profile notes unchanged and acknowledge these source changes.'}
      </label>
      {c.active ? <p>Apply when all agent runs have finished.</p> : null}
      {c.error ? (
        <p className="form-error" role="alert">
          {c.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          className="button primary"
          disabled={props.working || c.active || !c.verified}
          onClick={() => c.decide(true)}
        >
          {proposal.status === 'applying'
            ? 'Retry approved update'
            : proposal.documents.length
              ? 'Apply selected updates'
              : 'Acknowledge source changes'}
        </Button>
        <Button
          className="button"
          disabled={props.working || proposal.status === 'applying'}
          onClick={() => c.decide(false)}
        >
          Reject
        </Button>
      </div>
    </article>
  );
}
