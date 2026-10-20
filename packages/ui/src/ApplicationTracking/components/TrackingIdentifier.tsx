import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import type { Card } from '@pitchcrew/core';
import { useEffect, useState } from 'react';

export const TrackingIdentifier = ({
  card,
  onDirtyChange,
}: {
  card: Card;
  onDirtyChange?: (dirty: boolean) => void;
}) => {
  const [jobIdentifier, setJobIdentifier] = useState(card.tracking?.jobIdentifier ?? '');
  const dirty = jobIdentifier !== (card.tracking?.jobIdentifier ?? '');
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  const act = useWorkspaceStore((state) => state.act);
  const working = useWorkspaceStore((state) => state.working);
  return (
    <div className="my-3 flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 basis-48">
        Job identifier
        <Input
          maxLength={200}
          value={jobIdentifier}
          onChange={(event) => setJobIdentifier(event.target.value)}
          placeholder="Job or requisition ID"
        />
      </label>
      <Button
        disabled={working || jobIdentifier === (card.tracking?.jobIdentifier ?? '')}
        onClick={() =>
          act(
            `/tracking/applications/${card.id}/identifier`,
            'PUT',
            { jobIdentifier },
            'Job identifier saved',
          )
        }
      >
        Save identifier
      </Button>
    </div>
  );
};
