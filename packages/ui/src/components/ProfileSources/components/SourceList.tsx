import { SourceRow } from './SourceRow.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export function SourceList(c: ProfileSourcesModel) {
  return (
    <ul className="divide-y divide-border" aria-label="Saved profile sources">
      {c.sources.map((source) => (
        <SourceRow key={source.id} source={source} controller={c} />
      ))}
    </ul>
  );
}
