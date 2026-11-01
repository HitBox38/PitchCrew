import type { ProfileMaintenanceProposal } from '@pitchcrew/core';

/** Source, what changed upstream and what the user must verify; all from the saved proposal. */
export const ProposalSummary = ({ proposal }: { proposal: ProfileMaintenanceProposal }) => {
  return (
    <header className="profile-proposal-summary">
      <h3 className="ui-section-heading m-0 wrap-anywhere">{proposal.source.label}</h3>
      {proposal.observation ? (
        <p>
          Project changed from <code>{proposal.observation.previous.slice(0, 8)}</code> to{' '}
          <code>{proposal.observation.current.slice(0, 8)}</code>. A commit establishes a project
          change; verify your own contribution before adding it to your profile.
        </p>
      ) : null}
      {proposal.generated ? (
        <p>
          Agent-written notes require your factual verification. Review the pinned evidence and any
          uncertain claims.
        </p>
      ) : null}
      {proposal.missing.length ? (
        <p>Removed upstream; local notes will be kept: {proposal.missing.join(', ')}</p>
      ) : null}
      {proposal.restored?.length ? <p>Returned upstream: {proposal.restored.join(', ')}</p> : null}
    </header>
  );
};
