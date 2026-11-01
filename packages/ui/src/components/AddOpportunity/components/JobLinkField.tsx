import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Link2, LoaderCircle, MessageSquare } from 'lucide-react';
import { useId } from 'react';
import type { useJobLookup } from '../hooks/useJobLookup.ts';
import type { useScoutJobImport } from '../hooks/useScoutJobImport.ts';
import { jobLinkAction } from '../link-actions.ts';
import { LookupNotice } from './LookupNotice.tsx';

/** Provider links fill the form; other posting links can be sent to Scout explicitly. */
export const JobLinkField = ({
  lookup,
  working,
  scout,
  external,
  editing = false,
  close,
}: {
  lookup: ReturnType<typeof useJobLookup>;
  working: boolean;
  scout: ReturnType<typeof useScoutJobImport>;
  external: boolean;
  editing?: boolean;
  close: () => void;
}) => {
  const id = useId();
  const mode = jobLinkAction(lookup.url);
  const askScout = !editing && (mode === 'scout' || lookup.scoutUrl === lookup.url.trim());
  const blocker = askScout
    ? external
      ? 'Fill in this application yourself, or clear “Already applied” to ask Scout to add a lead.'
      : scout.blocker
    : '';
  return (
    <div className="field add-job-link">
      <label htmlFor={id} className="flex-row items-baseline gap-2">
        Job post URL <span className="optional">optional</span>
      </label>
      <div className="add-job-link-row">
        <Input
          id={id}
          aria-describedby={`${id}-help`}
          name="url"
          defaultValue={editing ? lookup.url : undefined}
          type="url"
          placeholder="https://…"
          maxLength={2000}
          onChange={lookup.changeLink}
          disabled={working}
        />
        <Button
          variant="outline"
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
      <p id={`${id}-help`} className="add-job-hint" aria-live="polite">
        {blocker ||
          (askScout
            ? 'Scout opens this link in a new conversation and adds the job. Or fill in the form.'
            : 'Nothing is saved until you add it.')}
      </p>
      {scout.error ? (
        <p className="form-error" role="alert">
          {scout.error}
        </p>
      ) : null}
      <LookupNotice
        message={lookup.message}
        duplicates={lookup.duplicates}
        close={editing ? undefined : close}
      />
    </div>
  );
};
