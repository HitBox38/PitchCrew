import { Button } from '@/components/ui/button/components/Button.tsx';
import type { JobSource } from '@pitchcrew/core';
import { Pencil, Trash2 } from 'lucide-react';
import { providerLabels } from '../constants.ts';
import { filterSummary, lastScanText } from '../helpers.ts';
import type { JobSourcesModel } from '../types.ts';

export function SourceRow({ source, model }: { source: JobSource; model: JobSourcesModel }) {
  return (
    <li className="job-source-row">
      <div className="min-w-0 flex-1">
        <strong>{source.name}</strong>
        <span className="quiet block">
          {providerLabels[source.provider]} · {source.slug}
          {source.enabled ? '' : ' · Paused'}
        </span>
        <span className="quiet block">{filterSummary(source)}</span>
        <span
          className={`quiet block ${source.lastScan?.status === 'failed' ? 'job-source-failed' : ''}`}
        >
          {lastScanText(source)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={model.busy}
          aria-pressed={source.enabled}
          onClick={() => model.setEnabled(source, !source.enabled)}
        >
          {source.enabled ? 'Pause' : 'Enable'}
        </Button>
        <Button
          variant="outline"
          disabled={model.busy || !!model.draft}
          onClick={() => model.startEdit(source)}
        >
          <Pencil size={14} /> Edit
        </Button>
        <Button
          variant="ghost"
          disabled={model.busy}
          aria-label={`Remove source ${source.name}; keep its leads`}
          onClick={() => model.remove(source)}
        >
          <Trash2 size={15} />
        </Button>
      </div>
    </li>
  );
}
