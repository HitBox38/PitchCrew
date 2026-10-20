import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Link2, LoaderCircle, MessageSquare } from 'lucide-react';
import { useId } from 'react';
import type { useJobLookup } from '../hooks/useJobLookup.ts';
import type { useScoutJobImport } from '../hooks/useScoutJobImport.ts';
import { jobLinkAction } from '../link-actions.ts';
import { LookupNotice } from './LookupNotice.tsx';

/** Provider links fill the form; other posting links can be sent to Scout explicitly. */
export function JobLinkField({
  lookup,
  working,
  scout,
  external,
}: {
  lookup: ReturnType<typeof useJobLookup>;
  working: boolean;
  scout: ReturnType<typeof useScoutJobImport>;
  external: boolean;
}) {
  const id = useId();
  const mode = jobLinkAction(lookup.url);
  const askScout = mode === 'scout' || lookup.scoutUrl === lookup.url.trim();
  const blocker = askScout
    ? external
      ? 'Fill in this application manually, or uncheck “Already applied” to ask Scout to add a lead.'
      : scout.blocker
    : '';
  return (
    <div className="field">
      <label htmlFor={id} className="flex-row items-baseline gap-2">
        Job post URL <span className="optional">optional</span>
      </label>
      <div className="flex gap-2 max-phone:flex-col">
        <Input
          id={id}
          aria-describedby={`${id}-help`}
          name="url"
          type="url"
          placeholder="https://…"
          maxLength={2000}
          onChange={lookup.changeLink}
          disabled={working}
        />
        <Button
          className="button shrink-0"
          disabled={mode === 'invalid' || lookup.pending || working || !!blocker}
          onClick={(event) =>
            void (askScout ? scout.askScout(event, lookup.scoutUrl) : lookup.fetchFromLink(event))
          }
        >
          {lookup.pending || scout.pending ? (
            <LoaderCircle className="spin" size={15} />
          ) : askScout ? (
            <MessageSquare size={15} />
          ) : (
            <Link2 size={15} />
          )}
          {askScout ? 'Ask Scout to add job' : 'Fetch from link'}
        </Button>
      </div>
      <p id={`${id}-help`} className="quiet font-normal" aria-live="polite">
        {blocker ||
          (askScout
            ? 'Opens a Scout conversation to read this link and add the job to your board. You can also fill in the form yourself.'
            : 'Fetch reads supported job boards and structured public job pages. Other links can be sent to Scout.')}
      </p>
      {scout.error ? (
        <p className="form-error" role="alert">
          {scout.error}
        </p>
      ) : null}
      <LookupNotice message={lookup.message} duplicates={lookup.duplicates} />
    </div>
  );
}
