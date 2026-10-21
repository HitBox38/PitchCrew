import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { useCallback, useState } from 'react';
import { useDirtyNotification } from '@/hooks/useDirtyNotification.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import type { JobOverviewProps } from '../types.ts';

export const ExternalConfirmation = ({
  id,
  act,
  working,
  onDirtyChange,
}: Pick<JobOverviewProps, 'act' | 'working'> & {
  id: string;
  onDirtyChange?: (id: string, dirty: boolean) => void;
}) => {
  const [url, setUrl] = useState('');
  const [evidence, setEvidence] = useState('');
  const [verified, setVerified] = useState(false);
  const notifyDirty = useCallback(
    (dirty: boolean) => onDirtyChange?.(id, dirty),
    [id, onDirtyChange],
  );
  useDirtyNotification(Boolean(url || evidence || verified), notifyDirty);
  return (
    <AccordionSection
      className="mt-3"
      contentClassName="form space-y-3"
      heading="Verify a confirmation you checked outside this browser run"
    >
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
    </AccordionSection>
  );
};
