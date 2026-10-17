import { ConnectAccountDialog } from '@/ConnectorSettings/components/ConnectAccountDialog.tsx';
import { ProfileMaintenance } from '../ProfileMaintenance/index.tsx';
import { SourceSetup } from './components/SourceSetup.tsx';
import { SourceListView } from './components/SourceListView.tsx';
import { SourceNotice } from './components/SourceNotice.tsx';
import { ImportReview } from './components/ImportReview.tsx';
import type { ProfileSourcesModel } from './types.ts';

export function ProfileSources(c: ProfileSourcesModel) {
  return (
    <section className="profile-sources" aria-label="Profile sources">
      {c.proposalId ? (
        c.proposal ? (
          <ProfileMaintenance
            {...c.maintenance}
            proposal={c.proposal}
            onReviewed={c.reviewed}
            onPendingChange={c.setProposalPending}
          />
        ) : (
          <output className="text-sm text-muted-foreground">
            This review is no longer pending. Go back to your sources to see the latest state.
          </output>
        )
      ) : c.adding ? (
        <SourceSetup {...c} />
      ) : (
        <>
          <SourceNotice {...c} />
          <SourceListView {...c} />
        </>
      )}
      <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
        Reviewed copies stay on this device. Adding a source does not grant agents account access.
      </p>
      <ImportReview {...c} />
      {c.connection.editing ? <ConnectAccountDialog {...c.connection} /> : null}
    </section>
  );
}
