import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog/index.tsx';
import { ProfileSources } from '@/components/ProfileSources/index.tsx';
import { useSourceDialogFocus } from '@/components/ProfileSources/hooks/useSourceDialogFocus.ts';
import { sourceHeading } from '@/components/ProfileSources/helpers.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ArrowLeft } from 'lucide-react';
import type { ProfileViewModel } from '../types.ts';

export const ProfileSourcesPanel = (c: ProfileViewModel) => {
  const sources = c.sourceController;
  const copy = sourceHeading(sources);
  const { heading: headingRef, panel: panelRef } = useSourceDialogFocus(sources, c.sourcesOpen);
  return (
    <Dialog
      open={c.sourcesOpen}
      onOpenChange={(open) => {
        if (!sources.proposalPending) {
          c.setSourcesOpen(open);
        }
      }}
    >
      <DialogContent
        className="modal profile-sources-dialog"
        initialFocus={headingRef}
        showCloseButton={!sources.proposalPending}
      >
        <DialogHeader className="shrink-0 gap-2 border-b border-border px-6 py-5 pr-12 text-left">
          {sources.screen !== 'list' ? (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 w-fit"
              disabled={sources.busy}
              onClick={sources.back}
            >
              <ArrowLeft size={14} /> Back to sources
            </Button>
          ) : null}
          <DialogTitle
            ref={headingRef}
            tabIndex={-1}
            className="font-sans text-lg leading-snug outline-none"
          >
            {copy.title}
          </DialogTitle>
          <DialogDescription className="max-w-lg text-sm leading-relaxed">
            {copy.description}
          </DialogDescription>
        </DialogHeader>
        <div ref={panelRef} className="profile-sources-panel">
          {c.sourcesOpen ? <ProfileSources {...sources} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
