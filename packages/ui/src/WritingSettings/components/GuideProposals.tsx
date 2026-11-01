import type { WritingGuide } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { SettingsSection } from '@/SettingsPage/components/SettingsSection.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

/** Critic suggestions waiting on the user; nothing is adopted until applied here. */
export const GuideProposals = ({
  guide,
  change,
  working,
}: {
  guide: WritingGuide;
  change: (data: Record<string, unknown>) => Promise<unknown>;
  working: boolean;
}) => {
  const roles = useWorkspaceStore((state) => state.data?.roles);
  const proposals = guide.proposals.filter((p) => p.status === 'pending');
  if (!proposals.length) return null;
  const decide = (id: string, approved: boolean) =>
    void change({ action: 'proposal_decision', id, approved }).catch(() => {});
  return (
    <SettingsSection id="writing-suggestions-heading" title="Suggestions" count={proposals.length}>
      <div className="settings-cards" aria-label="Proposed writing guide changes">
        {proposals.map((p) => (
          <article key={p.id} className="ui-card settings-proposal">
            <span className="ui-chip" data-tone="plum">
              Proposed by {roles?.find((role) => role.id === p.roleId)?.name ?? p.roleId}
            </span>
            <p className="settings-preference">{p.text}</p>
            <p className="quiet">{p.reason}</p>
            {p.revision !== guide.revision ? (
              <p className="quiet">
                The guide changed since this was proposed. Ask for a fresh one.
              </p>
            ) : null}
            <div className="settings-row-actions">
              <Button
                size="sm"
                variant="outline"
                disabled={working || p.revision !== guide.revision}
                onClick={() => decide(p.id, true)}
              >
                Apply suggestion
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={working}
                onClick={() => decide(p.id, false)}
              >
                Dismiss
              </Button>
            </div>
          </article>
        ))}
      </div>
    </SettingsSection>
  );
};
