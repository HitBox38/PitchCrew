import type { InstructionComparisonProps } from '@/ChatWork/types.ts';

export function InstructionComparison({ current, proposal }: InstructionComparisonProps) {
  return (
    <div className="chat-instruction-comparison">
      <div>
        <h5>{proposal.beforeRole ? 'Reviewed before' : 'Current'}</h5>
        <pre>{current.instructions || 'No custom instructions.'}</pre>
      </div>
      <div>
        <h5>Proposed</h5>
        <pre>{proposal.changes.instructions || 'No custom instructions.'}</pre>
      </div>
    </div>
  );
}
