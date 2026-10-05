import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Link2, LoaderCircle } from 'lucide-react';
import { useId } from 'react';
import type { useJobLookup } from '../hooks/useJobLookup.ts';
import { LookupNotice } from './LookupNotice.tsx';

/** The posting URL with a fetch action that fills the rest of the form for review. */
export function JobLinkField({ lookup }: { lookup: ReturnType<typeof useJobLookup> }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className="flex-row items-baseline gap-2">
        Job post URL <span className="optional">optional</span>
      </label>
      <div className="flex gap-2 max-phone:flex-col">
        <Input id={id} name="url" type="url" placeholder="https://…" maxLength={2000} />
        <Button
          className="button shrink-0"
          disabled={lookup.pending}
          onClick={(event) => void lookup.fetchFromLink(event)}
        >
          {lookup.pending ? <LoaderCircle className="spin" size={15} /> : <Link2 size={15} />}
          Fetch from link
        </Button>
      </div>
      <p className="quiet font-normal">
        Fetch reads Greenhouse, Ashby, Lever, Comeet and Workable posting links. You can also fill
        in the form yourself.
      </p>
      <LookupNotice message={lookup.message} duplicates={lookup.duplicates} />
    </div>
  );
}
