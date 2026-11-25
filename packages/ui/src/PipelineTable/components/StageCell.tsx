import { Bead } from '@/ClayInterface/components/Bead.tsx';
import type { TableRowModel } from '../types.ts';

/**
 * Where the job stands at rest: the shared stage bead (an empty socket for a lead, the neutral
 * ringed bead for a current stage, moss once applied) and its status.
 */
export const StageCell = ({ stage }: { stage: TableRowModel['stage'] }) => (
  <span className="pipeline-table-stage">
    <Bead tone={stage.tone} />
    {stage.label}
  </span>
);
