import { useState } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
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
    <details className="form mt-3 space-y-3">
      <summary>Verify a confirmation you checked outside this browser run</summary>
      <p className="quiet">
        This records your verification, including after a restart. The agent has not inspected this
        evidence.
      </p>
      <label>
        Confirmation source URL
        <Input type="url" value={url} onChange={(event) => setUrl(event.target.value)} />
      </label>
      <label>
        Exact confirmation and reference
        <Textarea
          maxLength={4000}
          value={evidence}
          onChange={(event) => setEvidence(event.target.value)}
        />
      </label>
      <label className="checkbox-label items-start">
        <Checkbox checked={verified} onCheckedChange={setVerified} />
        I checked that this confirms this application was submitted.
      </label>
      <Button
        className="button primary"
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
