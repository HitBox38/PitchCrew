import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import type { InstructionComparisonProps } from '@/ChatWork/types.ts';

export function InstructionComparison({ current, proposal }: InstructionComparisonProps) {
  return (
    <div className="chat-instruction-comparison">
      <div>
        <SourceBlock
          label={proposal.beforeRole ? 'Reviewed before' : 'Current instructions'}
          value={current.instructions || 'No custom instructions.'}
          contentClassName="max-h-44 font-sans"
        />
      </div>
      <div>
        <SourceBlock
          label="Proposed instructions"
          value={proposal.changes.instructions || 'No custom instructions.'}
          contentClassName="max-h-44 font-sans"
        />
      </div>
    </div>
  );
}
