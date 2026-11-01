import { ExternalSubmissionFields } from '@/ExternalSubmissionFields/index.tsx';
import { Checkbox } from '@pitchcrew/design-system/checkbox';

/** New jobs only: record a submission made elsewhere. It never sends an application. */
export const ExternalApplicationFields = ({
  external,
  setExternal,
  jobIdentifier,
}: {
  external: boolean;
  setExternal: (value: boolean) => void;
  jobIdentifier: string;
}) => (
  <fieldset className="add-job-applied" data-open={external || undefined}>
    <label className="checkbox-label">
      <Checkbox checked={external} onCheckedChange={setExternal} />
      <span>Already applied outside Pitchcrew</span>
    </label>
    {external ? (
      <div className="add-job-applied-fields">
        <ExternalSubmissionFields jobIdentifier={jobIdentifier} />
      </div>
    ) : null}
  </fieldset>
);
