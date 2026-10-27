import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { PipelineStage } from '../helpers.ts';
import type { useColumnSort } from '../hooks/useColumnSort.ts';
import { ColumnSortMenu } from './ColumnSortMenu.tsx';

export const PipelineHeading = ({
  stage,
  count,
  setAdd,
  disabled,
  ...sorting
}: ReturnType<typeof useColumnSort> & {
  stage: PipelineStage;
  count: number;
  setAdd: (open: boolean) => void;
  disabled: boolean;
}) => (
  <div className="column-heading mb-2.5 flex h-6.5 shrink-0 items-center gap-1 px-1">
    <span className="stage-dot mr-1 shrink-0" />
    <h2 id={`heading-${stage.id}`} className="min-w-0 truncate">
      {stage.label}
    </h2>
    <span className="column-count">{count}</span>
    <ColumnSortMenu label={stage.label} disabled={disabled} {...sorting} />
    {stage.id === 'lead' ? (
      <Button className="icon-button" aria-label="Add a job" onClick={() => setAdd(true)}>
        <Plus size={15} />
      </Button>
    ) : null}
  </div>
);
