import type { ProfileViewModel } from '../types.ts';
import type { useProfileWorkspace } from '../hooks/useProfileWorkspace.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { FolderOpen, PanelLeft, GitBranch } from 'lucide-react';

export function ProfileWorkspaceHeading({
  controller: c,
  workspace,
}: {
  controller: ProfileViewModel;
  workspace: ReturnType<typeof useProfileWorkspace>;
}) {
  const updates = (c.data.profileProposals ?? []).filter((proposal) =>
    ['pending', 'applying'].includes(proposal.status),
  ).length;
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
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
      <FolderOpen size={16} className="text-primary" />
      <span className="text-sm font-semibold">Profile notes</span>
      <Button
        variant="ghost"
        className="ml-auto h-7 gap-1.5 rounded-md px-2 text-xs text-muted-foreground"
        onClick={() => c.setSourcesOpen(true)}
        aria-haspopup="dialog"
      >
        <GitBranch size={14} /> Sources
        {updates ? <span className="profile-update-count">{updates}</span> : null}
      </Button>
    </header>
  );
}
