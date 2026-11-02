import { FileCheck2, GitBranch, TriangleAlert } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { proposalNotice } from '../helpers.ts';
import type { ProfileViewModel } from '../types.ts';

/** Saved source changes and finished reads waiting on the user, one line each; never inferred. */
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
            <Icon size={15} className="profile-notice-kind" data-tone={notice.tone} aria-hidden />
            <p className="profile-notice-text">
              <span className="profile-notice-title">{notice.title}</span>
              <span className="profile-notice-detail" title={notice.detail}>
                {notice.detail}
              </span>
            </p>
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
