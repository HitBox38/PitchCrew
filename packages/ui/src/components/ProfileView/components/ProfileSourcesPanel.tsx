import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet/index.tsx';
import { ProfileSources } from '@/components/ProfileSources/index.tsx';
import type { ProfileViewModel } from '../types.ts';

export function ProfileSourcesPanel(c: ProfileViewModel) {
  return (
    <Sheet open={c.sourcesOpen} onOpenChange={c.setSourcesOpen}>
      <SheetContent className="profile-sources-sheet">
        <SheetHeader className="shrink-0 border-b border-border px-6 py-5 pr-12">
          <SheetTitle>Profile sources</SheetTitle>
          <SheetDescription>
            Manage the folders behind your notes and review source updates.
          </SheetDescription>
        </SheetHeader>
        <div className="profile-sources-panel">
          <ProfileSources {...c.sourceController} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
