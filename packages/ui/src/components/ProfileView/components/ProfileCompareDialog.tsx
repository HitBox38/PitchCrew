import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pitchcrew/design-system/dialog';
import { Button } from '@pitchcrew/design-system/button';
import { compareCounts, compareRows } from '../compare.ts';
import { noteLabel } from '../helpers.ts';
import { ProfileCompareDiff } from './ProfileCompareDiff.tsx';

/** The copy on disk against the draft, line by line, with the two ways out. */
export const ProfileCompareDialog = ({
  name,
  disk,
  draft,
  close,
  keep,
}: {
  name: string;
  disk: string;
  draft: string;
  close: () => void;
  keep: (side: 'disk' | 'mine') => void;
}) => {
  const rows = useMemo(() => compareRows(disk, draft), [disk, draft]);
  const counts = compareCounts(rows);
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="modal profile-compare-dialog">
        <DialogHeader>
          <DialogTitle>Compare {noteLabel(name)}</DialogTitle>
          <DialogDescription>
            The copy on disk → your draft.{' '}
            <span className="text-moss">
              +{counts.added} {counts.added === 1 ? 'line' : 'lines'}
            </span>
            {' · '}
            <span className="text-rose">
              −{counts.removed} {counts.removed === 1 ? 'line' : 'lines'}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="profile-compare-body">
          <ProfileCompareDiff rows={rows} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => keep('disk')}>
            Use saved copy
          </Button>
          <Button onClick={() => keep('mine')}>Keep my draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
