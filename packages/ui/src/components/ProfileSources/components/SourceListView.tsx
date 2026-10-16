import { FolderInput, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { SourceList } from './SourceList.tsx';
import { SourceProviderChoices } from './SourceProviderChoices.tsx';
import { SourceProposalLinks } from './SourceProposalLinks.tsx';
import { SourceProgress } from './SourceProgress.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export function SourceListView(c: ProfileSourcesModel) {
  const unlinked = c.proposals.filter(
    (p) => !c.sources.some((source) => source.id === p.source.id),
  );
  return (
    <div className="grid gap-5">
      {c.sources.length ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {c.sources.length} saved {c.sources.length === 1 ? 'source' : 'sources'}
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
        <div className="grid gap-5 py-2">
          <div className="grid justify-items-center gap-2 py-3 text-center">
            <FolderInput size={28} className="mb-1 text-primary" aria-hidden="true" />
            <h3 className="font-serif text-xl font-semibold">Bring your background together</h3>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Start with a folder of personal notes, or watch a project for changes your crew can
              investigate.
            </p>
          </div>
          <SourceProviderChoices choose={c.startAdd} disabled={c.busy} />
        </div>
      ) : null}
      {unlinked.map((proposal) => (
        <div key={proposal.id} className="grid gap-2 border-t border-border pt-4">
          <p className="text-sm font-semibold wrap-anywhere">{proposal.source.label}</p>
          <p className="text-xs text-muted-foreground">
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
        <p className="text-xs leading-relaxed text-muted-foreground">
          Watching lets authorized agents check for changes. Use a routine for scheduled checks.
          Updates always need your review.
        </p>
      ) : null}
    </div>
  );
}
