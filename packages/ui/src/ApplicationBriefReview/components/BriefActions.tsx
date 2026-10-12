import { Button } from '@/components/ui/button/components/Button.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import type { useApplicationBrief } from '../hooks/useApplicationBrief.ts';
import type { Card } from '@pitchcrew/core';

export function BriefActions({
  model,
  card,
}: {
  model: ReturnType<typeof useApplicationBrief>;
  card: Card;
}) {
  if (!model.available.length)
    return (
      <p className="quiet">
        Enable Codex, Claude Code or OpenCode in Crew to extract or draft. You can prepare a brief
        manually.
      </p>
    );
  return (
    <div className="flex flex-wrap items-end gap-2">
      <FormSelect
        label="Application agent"
        value={model.roleId}
        onValueChange={model.setRoleId}
        options={model.available.map((role) => ({ value: role.id, label: role.name }))}
      />
      <Button
        variant="outline"
        disabled={model.disabled || !model.roleId || model.editing}
        onClick={() => {
          void model.extract();
        }}
      >
        Extract from source
      </Button>
      {model.confirmed && ['shortlisted', 'changes_requested'].includes(card.state) ? (
        <Button
          disabled={model.disabled || !model.roleId || model.editing}
          onClick={() => {
            void model.startDraft();
          }}
        >
          Draft application
        </Button>
      ) : null}
      {model.confirmed &&
      card.packet &&
      ['in_review', 'agreed', 'awaiting_approval'].includes(card.state) ? (
        <Button
          variant="outline"
          disabled={model.disabled || !model.reviewer || model.editing}
          onClick={() => {
            void model.reviewPacket();
          }}
        >
          Review existing packet
        </Button>
      ) : null}
    </div>
  );
}
