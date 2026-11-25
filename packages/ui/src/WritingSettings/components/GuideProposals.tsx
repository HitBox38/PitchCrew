import type { WritingGuide } from '@pitchcrew/core';
import { SettingsSection } from '@/SettingsPage/components/SettingsSection.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { GuideProposal } from './GuideProposal.tsx';

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
  return (
    <SettingsSection id="writing-suggestions-heading" title="Suggestions" count={proposals.length}>
      <div className="settings-cards" aria-label="Proposed writing guide changes">
        {proposals.map((p) => (
          <GuideProposal
            key={p.id}
            proposal={p}
            guide={guide}
            roleName={roles?.find((role) => role.id === p.roleId)?.name ?? p.roleId}
            change={change}
            working={working}
          />
        ))}
      </div>
    </SettingsSection>
  );
};
