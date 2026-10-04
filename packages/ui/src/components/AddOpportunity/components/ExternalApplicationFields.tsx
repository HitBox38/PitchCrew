import { ExternalSubmissionFields } from '@/ExternalSubmissionFields/index.tsx';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';

export function ExternalApplicationFields({
  external,
  setExternal,
}: {
  external: boolean;
  setExternal: (value: boolean) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <label className="checkbox-label">
        <Checkbox checked={external} onCheckedChange={setExternal} />
        <span>Already applied outside Pitchcrew</span>
      </label>
      {external ? (
        <>
          <p className="quiet">
            Record a known submission. This saves tracking information without sending an
            application.
          </p>
          <ExternalSubmissionFields />
        </>
      ) : null}
    </fieldset>
  );
}
