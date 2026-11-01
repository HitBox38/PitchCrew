import { Plus } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { SourceList } from './SourceList.tsx';
import { SourceProviderChoices } from './SourceProviderChoices.tsx';
import { SourceProposalLinks } from './SourceProposalLinks.tsx';
import { SourceProgress } from './SourceProgress.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export const SourceListView = (c: ProfileSourcesModel) => {
  const unlinked = c.proposals.filter(
    (p) => !c.sources.some((source) => source.id === p.source.id),
  );
  return (
    <div className="grid gap-4">
      {c.sources.length ? (
        <div className="flex items-center justify-between gap-3">
          <p className="ui-section-heading m-0">
            Saved <span className="ui-count">{c.sources.length}</span>
          </p>
          <Button size="sm" disabled={c.busy} data-source-focus="add" onClick={() => c.startAdd()}>
            <Plus size={15} /> Add source
          </Button>
        </div>
      ) : null}
      {c.loading ? <SourceProgress label="Loading sources…" /> : null}
      {c.listError ? (
        <div className="grid gap-2 text-sm">
          <p role="alert" className="form-error">
            {c.listError}
          </p>
          <Button className="w-fit" size="sm" disabled={c.busy} onClick={() => void c.refresh()}>
            Retry loading sources
          </Button>
        </div>
      ) : null}
      {c.sources.length ? (
        <SourceList {...c} />
      ) : c.loaded && !c.loading && !c.listError ? (
        <div className="grid gap-3">
          <h3 className="ui-section-heading m-0">Bring your background together</h3>
          <SourceProviderChoices choose={c.startAdd} disabled={c.busy} />
        </div>
      ) : null}
      {unlinked.map((proposal) => (
        <div key={proposal.id} className="ui-tray grid gap-2">
          <p className="text-label font-semibold wrap-anywhere">{proposal.source.label}</p>
          <p className="text-detail text-muted-foreground">
            {c.loaded
              ? 'This source is no longer connected. Its saved review is still available.'
              : 'A saved update is available for review.'}
          </p>
          <SourceProposalLinks proposals={[proposal]} controller={c} />
        </div>
      ))}
      {c.error && !c.preview ? (
        <p role="alert" className="form-error">
          {c.error}
        </p>
      ) : null}
      {c.sources.length ? (
        <p className="text-detail text-muted-foreground">
          Watching lets authorized agents check for changes; a routine can schedule checks. Updates
          always need your review.
        </p>
      ) : null}
    </div>
  );
};
