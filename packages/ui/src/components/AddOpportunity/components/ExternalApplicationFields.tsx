import { ExternalSubmissionFields } from '@/ExternalSubmissionFields/index.tsx';

export function ExternalApplicationFields({
  external,
  setExternal,
}: {
  external: boolean;
  setExternal: (value: boolean) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <label className="flex items-center gap-2 [&&]:flex-row">
        <input
          type="checkbox"
          checked={external}
          onChange={(event) => setExternal(event.target.checked)}
        />
        Already applied outside Pitchcrew
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
