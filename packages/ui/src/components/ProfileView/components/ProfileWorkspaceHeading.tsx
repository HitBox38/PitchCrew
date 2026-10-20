import type { ProfileViewModel } from '../types.ts';
import type { useProfileWorkspace } from '../hooks/useProfileWorkspace.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { FolderOpen, PanelLeft, GitBranch } from 'lucide-react';

export const ProfileWorkspaceHeading = ({
  controller: c,
  workspace,
}: {
  controller: ProfileViewModel;
  workspace: ReturnType<typeof useProfileWorkspace>;
}) => {
  const updates = (c.data.profileProposals ?? []).filter((proposal) =>
    ['pending', 'applying'].includes(proposal.status),
  ).length;
  return (
    <header className="profile-workspace-heading">
      <Button
        variant="ghost"
        className="profile-explorer-toggle"
        aria-label={workspace.explorerVisible ? 'Hide notes explorer' : 'Show notes explorer'}
        aria-expanded={workspace.explorerVisible}
        aria-controls="profile-explorer"
        onClick={workspace.toggleExplorer}
      >
        <PanelLeft size={16} />
      </Button>
      <FolderOpen size={18} className="shrink-0 text-primary" />
      <div className="profile-heading-copy">
        <h1>Profile</h1>
        <p>Your background and project notes for the crew.</p>
      </div>
      <Button
        variant="ghost"
        className="button small profile-sources-action"
        onClick={() => c.setSourcesOpen(true)}
        aria-haspopup="dialog"
      >
        <GitBranch size={14} /> Sources
        {updates ? <span className="profile-update-count">{updates}</span> : null}
      </Button>
    </header>
  );
};
