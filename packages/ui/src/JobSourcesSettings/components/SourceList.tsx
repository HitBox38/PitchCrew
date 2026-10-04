import type { JobSourcesModel } from '../types.ts';
import { SourceRow } from './SourceRow.tsx';

export function SourceList(model: JobSourcesModel) {
  if (!model.sources.length)
    return (
      <p className="quiet mt-5">
        No job sources yet. Add a company&apos;s public job board to start finding leads.
      </p>
    );
  return (
    <ul className="mt-5 grid gap-3" aria-label="Saved job sources">
      {model.sources.map((source) => (
        <SourceRow key={source.id} source={source} model={model} />
      ))}
    </ul>
  );
}
