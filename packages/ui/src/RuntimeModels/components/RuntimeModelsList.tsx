import type { ManagedRuntimeModel, RuntimeModel } from '@pitchcrew/core';
import type { RuntimeModelsModel } from '../types.ts';
import { RuntimeModelRow } from './RuntimeModelRow.tsx';
import { useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';

export const RuntimeModelsList = ({
  model,
  models,
  query,
  editing,
  edit,
}: {
  model: RuntimeModelsModel;
  models: ManagedRuntimeModel[];
  query: string;
  editing: boolean;
  edit: (entry: RuntimeModel) => void;
}) => {
  const [page, setPage] = useState({ query, limit: 50 });
  if (page.query !== query) setPage({ query, limit: 50 });
  const shown = models.filter((entry) =>
    `${entry.label} ${entry.value}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      {shown.length ? (
        <ul className="settings-list" aria-label="Model choices">
          {shown.slice(0, page.query === query ? page.limit : 50).map((entry) => (
            <RuntimeModelRow
              key={entry.value}
              entry={entry}
              model={model}
              edit={() => edit(entry)}
              disabled={model.busy || editing || model.recoveryNeeded}
            />
          ))}
        </ul>
      ) : (
        <p className="ui-empty">
          {query
            ? 'No models match this search.'
            : 'No models reported. Recheck sign-in, refresh models or add a custom selector.'}
        </p>
      )}
      {shown.length > page.limit ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setPage((current) => ({ ...current, limit: current.limit + 50 }))}
        >
          Show more models ({shown.length - page.limit} remaining)
        </Button>
      ) : null}
    </>
  );
};
