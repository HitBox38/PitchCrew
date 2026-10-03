import type { Card, Role } from '@pitchcrew/core';
import type { DraftFieldsProps } from '../types.ts';

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
        <input
          required
          maxLength={120}
          value={draft.name}
          onChange={(event) => change({ name: event.target.value })}
          placeholder="Morning job-search check-in"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Agent
          <select
            value={draft.roleId}
            onChange={(event) => change({ roleId: event.target.value as Role['id'] })}
          >
            {roles
              .filter((role) => !role.retiredAt)
              .map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                  {role.enabled ? '' : ' (paused)'}
                </option>
              ))}
          </select>
        </label>
        <label>
          Attached job
          <select value={draft.cardId} onChange={(event) => change({ cardId: event.target.value })}>
            <option value="">No job attached</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.company} — {card.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        What should the agent do?
        <textarea
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
