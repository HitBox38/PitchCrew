import { useEffect, useState } from 'react';
import type { RuntimeInfo, RuntimeModelCatalog } from '@pitchcrew/core';
import { preferredRuntimeModels } from '@pitchcrew/core/runtime-model-preferences';
import { Input } from '@pitchcrew/design-system/input';
import { AccordionSection } from '@pitchcrew/design-system/accordion';

import { runtimeLabels } from '@/lib/labels.ts';
import { useRuntimeModels } from '../hooks/useRuntimeModels.ts';
import { useModelEditor } from '../hooks/useModelEditor.ts';
import { RuntimeModelsToolbar } from './RuntimeModelsToolbar.tsx';
import { RuntimeModelsEditor } from './RuntimeModelsEditor.tsx';
import { RuntimeModelsList } from './RuntimeModelsList.tsx';
import { RuntimeModelsFeedback } from './RuntimeModelsFeedback.tsx';

export const RuntimeModelsPanel = ({
  runtime,
  onDirtyChange,
  onCatalogChange,
}: {
  runtime: RuntimeInfo;
  onDirtyChange?: (value: boolean) => void;
  onCatalogChange?: (catalog: RuntimeModelCatalog) => void;
}) => {
  const model = useRuntimeModels(runtime.id);
  const catalog = model.state?.catalog;
  useEffect(() => {
    if (catalog) onCatalogChange?.(catalog);
  }, [catalog, onCatalogChange]);
  const [query, setQuery] = useState('');
  const { editor, setEditor } = useModelEditor(runtime.id);
  const state = model.state;
  const all = state
    ? preferredRuntimeModels(state.catalog, state.preferences, { includeHidden: true })
    : [];
  return (
    <section aria-label={`${runtimeLabels[runtime.id]} models`} className="space-y-3">
      <RuntimeModelsToolbar model={model} editing={!!editor} add={() => setEditor('new')} />
      <RuntimeModelsFeedback model={model} />
      <p className="quiet">
        Favorites appear first. Hidden choices stay on agents already using them. Changes apply to
        this workspace.
      </p>
      {!state ? (
        <p className="quiet">
          {model.error ? 'Retry loading model choices above.' : 'Loading model choices…'}
        </p>
      ) : (
        <>
          <Input
            aria-label={`Filter ${runtimeLabels[runtime.id]} models`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter models…"
            type="search"
          />
          {editor ? (
            <RuntimeModelsEditor
              key={typeof editor === 'string' ? editor : editor.value}
              editor={editor}
              model={model}
              models={all}
              close={() => setEditor(null)}
              onDirtyChange={onDirtyChange}
            />
          ) : null}
          <RuntimeModelsList
            model={model}
            models={all}
            query={query}
            editing={!!editor}
            edit={setEditor}
          />
          <AccordionSection heading="About model choices">
            <p className="quiet pt-3">
              {state.catalog.modelDetail} Custom definitions do not verify availability or reasoning
              support.
            </p>
          </AccordionSection>
        </>
      )}
    </section>
  );
};
