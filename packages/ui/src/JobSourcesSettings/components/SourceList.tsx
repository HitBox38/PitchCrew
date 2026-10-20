import { Radar } from 'lucide-react';
import type { JobSourcesModel } from '../types.ts';
import { SourceRow } from './SourceRow.tsx';

export const SourceList = (model: JobSourcesModel) => {
  if (!model.sources.length)
    return (
      <div className="settings-empty mt-5 flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
        <Radar size={26} className="text-muted" aria-hidden="true" />
        <h3>No job sources yet</h3>
        <p className="quiet max-w-[48ch]">
          Add a company&apos;s public job board to start finding leads.
        </p>
      </div>
    );
  return (
    <ul className="settings-source-list mt-5 grid" aria-label="Saved job sources">
      {model.sources.map((source) => (
        <SourceRow key={source.id} source={source} model={model} />
      ))}
    </ul>
  );
};
