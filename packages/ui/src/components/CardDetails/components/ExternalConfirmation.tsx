import { useState } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { JobOverviewProps } from '../types.ts';

export function ExternalConfirmation({
  id,
  act,
  working,
}: Pick<JobOverviewProps, 'act' | 'working'> & { id: string }) {
  const [url, setUrl] = useState('');
  const [evidence, setEvidence] = useState('');
  const [verified, setVerified] = useState(false);
  return (
    <details className="mt-3 space-y-2">
      <summary>Verify a confirmation you checked outside this browser run</summary>
      <p className="quiet">
        This records your verification, including after a restart. The agent has not inspected this
        evidence.
      </p>
      <label className="block">
        Confirmation source URL
        <input
          className="mt-1 w-full rounded border p-2"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <label className="block">
        Exact confirmation and reference
        <textarea
          className="mt-1 w-full rounded border p-2"
          maxLength={4000}
          value={evidence}
          onChange={(event) => setEvidence(event.target.value)}
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={verified}
          onChange={(event) => setVerified(event.target.checked)}
        />
        I checked that this confirms this application was submitted.
      </label>
      <Button
        disabled={working || !verified || !url.trim() || !evidence.trim()}
        onClick={() =>
          act(
            `/submissions/${id}/resolve`,
            {
              confirmed: true,
              reason: 'User verified external submission confirmation',
              external: { url, evidence, verified: true },
            },
            'User verification saved',
          )
        }
      >
        Save my verification
      </Button>
    </details>
  );
}
