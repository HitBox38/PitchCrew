import type { Card, Role } from '@pitchcrew/core';
import type { DraftFieldsProps } from '../types.ts';
import { FormSelect } from '@/FormSelect/index.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import { Textarea } from '@/components/ui/textarea/index.tsx';

export function ActionFields({
  draft,
  change,
  roles,
  cards,
}: DraftFieldsProps & { roles: Role[]; cards: Card[] }) {
  return (
    <>
      <label>
        Name
        <Input
          required
          maxLength={120}
          value={draft.name}
          onChange={(event) => change({ name: event.target.value })}
          placeholder="Morning job-search check-in"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect
          label="Agent"
          value={draft.roleId}
          onValueChange={(roleId) => change({ roleId })}
          options={roles
            .filter((role) => !role.retiredAt)
            .map((role) => ({
              value: role.id,
              label: `${role.name}${role.enabled ? '' : ' (paused)'}`,
            }))}
        />
        <FormSelect
          label="Attached job"
          value={draft.cardId}
          onValueChange={(cardId) => change({ cardId })}
          options={[
            { value: '', label: 'No job attached' },
            ...cards.map((card) => ({ value: card.id, label: `${card.company} — ${card.title}` })),
          ]}
        />
      </div>
      <label>
        What should the agent do?
        <Textarea
          required
          rows={4}
          maxLength={8000}
          value={draft.content}
          onChange={(event) => change({ content: event.target.value })}
          placeholder="Review my active applications and tell me which need a follow-up."
        />
      </label>
    </>
  );
}
