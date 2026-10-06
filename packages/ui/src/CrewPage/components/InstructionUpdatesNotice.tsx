import { Button } from '@/components/ui/button/components/Button.tsx';
import { joinNames, pendingInstructionUpdates } from '@/lib/instruction-updates.ts';
import type { RoleId, Snapshot } from '@pitchcrew/core';
import { Sparkles } from 'lucide-react';

/** Crew summary of unanswered default instruction updates. */
export function InstructionUpdatesNotice({
  data,
  onReview,
}: {
  data: Snapshot;
  onReview: (id: RoleId) => void;
}) {
  const updates = pendingInstructionUpdates(data);
  if (!updates.length) return null;
  const name = (id: RoleId) => data.roles.find((role) => role.id === id)?.name ?? id;
  return (
    <aside
      className="instruction-updates-notice mb-5 flex flex-wrap items-center gap-3"
      aria-label="Instructions updates"
    >
      <Sparkles size={18} className="text-plum" aria-hidden="true" />
      <p className="flex-1 text-sm">
        New default instructions are available for{' '}
        {joinNames(updates.map((update) => name(update.roleId)))}. Nothing changes until you review
        and choose.
      </p>
      <div className="flex flex-wrap gap-2">
        {updates.map((update) => (
          <Button key={update.roleId} className="button" onClick={() => onReview(update.roleId)}>
            Review {name(update.roleId)}
          </Button>
        ))}
      </div>
    </aside>
  );
}
