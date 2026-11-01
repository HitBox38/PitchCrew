import type { JobSourcesModel } from '../types.ts';
import { SourceRow } from './SourceRow.tsx';

export const SourceList = (model: JobSourcesModel) => {
  if (!model.sources.length)
    return model.draft ? null : <p className="ui-empty">Save a board for Scout to check.</p>;
  return (
    <ul className="settings-list" aria-label="Saved job sources">
      {model.sources.map((source) => (
        <SourceRow key={source.id} source={source} model={model} />
      ))}
    </ul>
  );
};
