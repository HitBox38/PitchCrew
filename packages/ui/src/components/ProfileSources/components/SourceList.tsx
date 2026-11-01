import { SourceRow } from './SourceRow.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export const SourceList = (c: ProfileSourcesModel) => {
  return (
    <ul className="profile-source-list" aria-label="Saved profile sources">
      {c.sources.map((source) => (
        <SourceRow key={source.id} source={source} controller={c} />
      ))}
    </ul>
  );
};
