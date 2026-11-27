import type { WritingGuide } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';

type Props = {
  proposal: WritingGuide['proposals'][number];
  guide: WritingGuide;
  /** The proposing agent's name. */
  roleName: string;
  /** Sends one change to the guide (`guideChange`). */
  change: (data: Record<string, unknown>) => Promise<unknown>;
  working: boolean;
};

/** One critic suggestion: the exact preference, why, and Apply suggestion or Dismiss. */
export const GuideProposal = ({ proposal, guide, roleName, change, working }: Props) => {
  const stale = proposal.revision !== guide.revision;
  const decide = (approved: boolean) =>
    void change({ action: 'proposal_decision', id: proposal.id, approved }).catch(() => {});
  return (
    <article className="ui-card settings-proposal">
      <span className="ui-chip" data-tone="plum">
        Proposed by {roleName}
      </span>
      <p className="settings-preference">{proposal.text}</p>
      <p className="quiet">{proposal.reason}</p>
      {stale ? (
        <p className="quiet">The guide changed since this was proposed. Ask for a fresh one.</p>
      ) : null}
      <div className="settings-row-actions">
        <Button
          size="sm"
          variant="outline"
          disabled={working || stale}
          onClick={() => decide(true)}
        >
          Apply suggestion
        </Button>
        <Button size="sm" variant="ghost" disabled={working} onClick={() => decide(false)}>
          Dismiss
        </Button>
      </div>
    </article>
  );
};
