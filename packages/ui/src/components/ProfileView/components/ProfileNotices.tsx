import { FileCheck2, GitBranch, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { proposalNotice } from '../helpers.ts';
import type { ProfileViewModel } from '../types.ts';

/** Saved source changes and finished reads waiting on the user; never inferred. */
export const ProfileNotices = (c: ProfileViewModel) => {
  const preview = useWorkspaceStore((state) => state.profileSources.preview);
  const sources = c.sourceController;
  const notices = [
    ...(preview
      ? [
          {
            id: 'preview',
            tone: 'primary',
            title: 'Documents ready to review',
            detail: preview.source.label,
            review: () => c.setSourcesOpen(true),
          },
        ]
      : []),
    ...sources.proposals.map((proposal) => ({
      id: proposal.id,
      ...proposalNotice(proposal),
      review: () => {
        sources.reviewProposal(proposal.id);
        c.setSourcesOpen(true);
      },
    })),
  ].slice(0, 3);
  if (!notices.length) return null;
  return (
    <ul className="profile-notices" aria-label="Waiting for your review">
      {notices.map((notice) => {
        const Icon =
          notice.tone === 'ochre'
            ? TriangleAlert
            : notice.id === 'preview'
              ? FileCheck2
              : GitBranch;
        return (
          <li key={notice.id} className="profile-notice">
            <span className="profile-notice-kind" data-tone={notice.tone} aria-hidden="true">
              <Icon size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="profile-notice-title">{notice.title}</p>
              <p className="profile-notice-detail" title={notice.detail}>
                {notice.detail}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Review ${notice.title}`}
              onClick={notice.review}
            >
              Review
            </Button>
          </li>
        );
      })}
    </ul>
  );
};
