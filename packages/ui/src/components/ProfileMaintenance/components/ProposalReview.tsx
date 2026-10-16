import { Button } from '@/components/ui/button/components/Button.tsx';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import type { ProposalReviewProps } from '../types.ts';
import { SourceProgress } from '../../ProfileSources/components/SourceProgress.tsx';
import { useProposalReview } from '../hooks/useProposalReview.ts';
import { ProposalDocuments } from './ProposalDocuments.tsx';

export function ProposalReview(props: ProposalReviewProps) {
  const c = useProposalReview(props);
  const { proposal } = props;
  return (
    <article className="grid gap-4 text-sm" aria-busy={c.pending}>
      <h3 className="font-serif text-lg font-semibold wrap-anywhere">{proposal.source.label}</h3>
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
        disabled={props.working || c.pending || proposal.status === 'applying'}
      />
      {proposal.missing.length ? (
        <p>Removed upstream; local notes will be kept: {proposal.missing.join(', ')}</p>
      ) : null}
      {proposal.restored?.length ? <p>Returned upstream: {proposal.restored.join(', ')}</p> : null}
      <label className="flex items-start gap-3 leading-relaxed">
        <Checkbox
          checked={c.verified}
          disabled={props.working || c.pending || proposal.status === 'applying'}
          onCheckedChange={c.setVerified}
        />
        {proposal.documents.length
          ? 'I reviewed the selected documents and verified their personal facts. They may be used as resume evidence.'
          : 'I reviewed this observation. Keep profile notes unchanged and acknowledge these source changes.'}
      </label>
      {c.active ? <p>Apply when all agent runs have finished.</p> : null}
      {c.pending ? <SourceProgress label={c.progress} /> : null}
      {c.error ? (
        <p className="form-error" role="alert">
          {c.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          className="button primary"
          disabled={props.working || c.pending || c.active || !c.verified}
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
          disabled={props.working || c.pending || proposal.status === 'applying'}
          onClick={() => c.decide(false)}
        >
          Reject
        </Button>
      </div>
    </article>
  );
}
