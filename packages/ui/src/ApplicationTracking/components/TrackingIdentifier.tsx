import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import type { Card } from '@pitchcrew/core';
import { useState } from 'react';

export function TrackingIdentifier({ card }: { card: Card }) {
  const [jobIdentifier, setJobIdentifier] = useState(card.tracking?.jobIdentifier ?? '');
  const act = useWorkspaceStore((state) => state.act);
  const working = useWorkspaceStore((state) => state.working);
  return (
    <div className="my-3 flex flex-wrap items-end gap-2">
      <label>
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
}
