import { Button } from '@/components/ui/button/components/Button.tsx';
import { jobProviderLabels } from '@/lib/labels.ts';
import type { JobSource } from '@pitchcrew/core';
import { Pencil } from 'lucide-react';
import { Switch } from '@/components/ui/switch/index.tsx';
import { RemoveSource } from './RemoveSource.tsx';
import { filterSummary, lastScanText } from '../helpers.ts';
import type { JobSourcesModel } from '../types.ts';

export const SourceRow = ({ source, model }: { source: JobSource; model: JobSourcesModel }) => {
  return (
    <li className="job-source-row">
      <div className="min-w-0 flex-1">
        <strong>{source.name}</strong>
        <span className="quiet block">
          {jobProviderLabels[source.provider]} · {source.slug}
        </span>
        <span className="quiet block">{filterSummary(source)}</span>
        <span
          className={`quiet block ${source.lastScan?.status === 'failed' ? 'job-source-failed' : ''}`}
        >
          {lastScanText(source)}
        </span>
      </div>
      <span className={`badge ${source.enabled ? 'success' : ''}`}>
        {source.enabled ? 'Watching' : 'Paused'}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Switch
          checked={source.enabled}
          disabled={model.busy || !!model.draft}
          aria-label={`Watch ${source.name}`}
          onCheckedChange={(enabled) => model.setEnabled(source, enabled)}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={model.busy || !!model.draft}
          onClick={() => model.startEdit(source)}
        >
          <Pencil size={14} aria-hidden="true" /> Edit
        </Button>
        <RemoveSource source={source} model={model} />
      </div>
    </li>
  );
};
