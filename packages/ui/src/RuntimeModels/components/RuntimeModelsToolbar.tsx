import { Button } from '@pitchcrew/design-system/button';
import { RefreshCw, Plus } from 'lucide-react';
import type { RuntimeModelsModel } from '../types.ts';

export const RuntimeModelsToolbar = ({
  model,
  editing,
  add,
}: {
  model: RuntimeModelsModel;
  editing: boolean;
  add: () => void;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <div className="flex items-center gap-2">
      <h3>Models</h3>
      <output className="quiet">{model.notice}</output>
    </div>
    <div className="settings-row-actions">
      <Button
        size="sm"
        variant="ghost"
        disabled={model.busy || editing || model.recoveryNeeded}
        onClick={() => void model.refresh()}
      >
        <RefreshCw size={14} aria-hidden="true" /> Refresh models
      </Button>
      <Button
        id={`runtime-${model.id}-add-custom-model`}
        size="sm"
        variant="outline"
        disabled={!model.state || model.busy || editing || model.recoveryNeeded}
        onClick={add}
      >
        <Plus size={14} aria-hidden="true" /> Add custom model
      </Button>
    </div>
  </div>
);
