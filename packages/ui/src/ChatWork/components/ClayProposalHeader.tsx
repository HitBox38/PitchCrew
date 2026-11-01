import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { timeAgo } from '@/lib/time.ts';

type ClayProposalHeaderProps = {
  avatar: string;
  title: string;
  proposer: string;
  createdAt: string;
  summary: string;
};

/** Clay proposal heading: who proposed it on a plum chip, then one line on what it changes. */
export const ClayProposalHeader = ({
  avatar,
  title,
  proposer,
  createdAt,
  summary,
}: ClayProposalHeaderProps) => {
  return (
    <header className="clay-proposal-header">
      <RoleAvatar agentRole={avatar} />
      <div>
        <h4>{title}</h4>
        <p className="clay-proposal-meta">
          <span className="clay-proposal-chip">
            <span className="clay-bead" data-size="sm" data-tone="plum" aria-hidden="true" />
            Proposed by {proposer}
          </span>
          <time dateTime={createdAt}>{timeAgo(createdAt)}</time>
        </p>
      </div>
      <p className="clay-proposal-summary">{summary}</p>
    </header>
  );
};
