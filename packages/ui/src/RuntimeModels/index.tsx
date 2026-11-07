import type { RuntimeInfo, RuntimeModelCatalog } from '@pitchcrew/core';
import { RuntimeModelsPanel } from './components/RuntimeModelsPanel.tsx';

/** Workspace choices never rewrite saved agent or conversation models. */
export const RuntimeModels = (props: {
  runtime: RuntimeInfo;
  onDirtyChange?: (value: boolean) => void;
  onCatalogChange?: (catalog: RuntimeModelCatalog) => void;
}) => <RuntimeModelsPanel key={props.runtime.id} {...props} />;
