import { Button } from '@/components/ui/button/components/Button.tsx';
import { joinNames, pendingInstructionUpdates } from '@/lib/instruction-updates.ts';
import type { RoleId, Snapshot } from '@pitchcrew/core';
import { Sparkles } from 'lucide-react';
import { WorkspaceNotice } from '@/WorkspaceNotice/index.tsx';

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
    <WorkspaceNotice
      title="New default instructions"
      icon={<Sparkles size={20} className="text-plum" />}
      actions={updates.map((update) => (
        <Button
          key={update.roleId}
          className="button small h-auto min-h-8 max-w-full py-1.5 wrap-anywhere whitespace-normal"
          onClick={() => onReview(update.roleId)}
        >
          Review {name(update.roleId)}
        </Button>
      ))}
    >
      Available for {joinNames(updates.map((update) => name(update.roleId)))}. Nothing changes until
      you review and choose.
    </WorkspaceNotice>
  );
}
