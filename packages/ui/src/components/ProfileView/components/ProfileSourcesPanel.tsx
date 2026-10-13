import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog/index.tsx';
import { ProfileSources } from '@/components/ProfileSources/index.tsx';
import type { ProfileViewModel } from '../types.ts';

export function ProfileSourcesPanel(c: ProfileViewModel) {
  return (
    <Dialog open={c.sourcesOpen} onOpenChange={c.setSourcesOpen}>
      <DialogContent className="modal profile-sources-dialog">
        <DialogHeader className="min-h-17 shrink-0 border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="font-sans text-lg">Profile sources</DialogTitle>
          <DialogDescription>
            Manage the folders behind your notes and review source updates.
          </DialogDescription>
        </DialogHeader>
        <div className="profile-sources-panel">
          <ProfileSources {...c.sourceController} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
