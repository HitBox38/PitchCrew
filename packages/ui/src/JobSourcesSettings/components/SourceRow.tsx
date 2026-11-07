import { Button } from '@pitchcrew/design-system/button';
import { jobProviderLabels } from '@/lib/labels.ts';
import type { JobSource } from '@pitchcrew/core';
import { Switch } from '@pitchcrew/design-system/switch';
import { RemoveSource } from './RemoveSource.tsx';
import { filterSummary, lastScanText } from '../helpers.ts';
import type { JobSourcesModel } from '../types.ts';

export const SourceRow = ({ source, model }: { source: JobSource; model: JobSourcesModel }) => {
  const failed = source.lastScan?.status === 'failed';
  return (
    <li className="settings-list-row">
      <div className="settings-list-main">
        <div className="min-w-0 flex-1 basis-56">
          <div className="settings-list-title">
            <h4 id={`source-name-${source.id}`}>{source.name}</h4>
            <span className="ui-row-meta wrap-anywhere">
              {jobProviderLabels[source.provider]} · {source.slug}
            </span>
            {!source.enabled ? <span className="ui-chip">Not watched</span> : null}
          </div>
          <p className="quiet">{filterSummary(source)}</p>
          <p className={`quiet ${failed ? 'settings-failed' : ''}`}>{lastScanText(source)}</p>
        </div>
        <div className="settings-row-actions">
          <label className="settings-source-watch" htmlFor={`source-watch-${source.id}`}>
            <span id={`source-watch-label-${source.id}`}>Watch</span>
            <Switch
              id={`source-watch-${source.id}`}
              checked={source.enabled}
              disabled={model.busy || !!model.draft}
              aria-labelledby={`source-watch-label-${source.id} source-name-${source.id}`}
              onCheckedChange={(enabled) => model.setEnabled(source, enabled)}
            />
          </label>
          <Button
            variant="ghost"
            size="sm"
            disabled={model.busy || !!model.draft}
            onClick={() => model.startEdit(source)}
          >
            Edit
          </Button>
          <RemoveSource source={source} model={model} />
        </div>
      </div>
    </li>
  );
};
