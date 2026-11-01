import { Button } from '@/components/ui/button/components/Button.tsx';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import type { ProposalReviewProps } from '../types.ts';
import { SourceProgress } from '../../ProfileSources/components/SourceProgress.tsx';
import { useProposalReview } from '../hooks/useProposalReview.ts';
import { ProposalDocuments } from './ProposalDocuments.tsx';
import { ProposalSummary } from './ProposalSummary.tsx';

export const ProposalReview = (props: ProposalReviewProps) => {
  const c = useProposalReview(props);
  const { proposal } = props;
  const deciding = props.working || c.pending;
  const locked = deciding || proposal.status === 'applying';
  return (
    <article className="profile-proposal" aria-busy={c.pending}>
      <ProposalSummary proposal={proposal} />
      <ProposalDocuments
        proposal={proposal}
        selected={c.selected}
        toggle={c.toggle}
        disabled={locked}
      />
      <label className="profile-proposal-verify">
        <Checkbox checked={c.verified} disabled={locked} onCheckedChange={c.setVerified} />
        <span>
          {proposal.documents.length
            ? 'I reviewed the selected documents and verified their personal facts. They may be used as resume evidence.'
            : 'I reviewed this observation. Keep profile notes unchanged and acknowledge these source changes.'}
        </span>
      </label>
      <footer className="profile-proposal-footer">
        <div className="ui-footer-note grid gap-1">
          {c.active ? <p>Apply when all agent runs have finished.</p> : null}
          {c.pending ? <SourceProgress label={c.progress} /> : null}
          {c.error ? (
            <p className="form-error" role="alert">
              {c.error}
            </p>
          ) : null}
        </div>
        <Button variant="outline" disabled={locked} onClick={() => c.decide(false)}>
          Reject
        </Button>
        <Button disabled={deciding || c.active || !c.verified} onClick={() => c.decide(true)}>
          {proposal.status === 'applying'
            ? 'Retry approved update'
            : proposal.documents.length
              ? 'Apply selected updates'
              : 'Acknowledge source changes'}
        </Button>
      </footer>
    </article>
  );
};
