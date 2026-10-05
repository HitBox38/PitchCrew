import {
  decodeEvent,
  defaultCapabilities,
  type AgentCapabilities,
  type DefaultInstructionStatus,
  type Role,
} from '@pitchcrew/core';
import { defaultInstructionHistory } from './default-instruction-history.ts';
import { defaultRoles } from './default-roles.ts';
import { instructionRevision } from './instruction-revisions.ts';
import type { BoardContext } from './types.ts';

/**
 * Compares each seeded, non-retired default role with the current default text.
 * Read-only: detection never changes a role. Cached until the next board event.
 */
export function defaultInstructionStatuses(this: BoardContext): DefaultInstructionStatus[] {
  const { id } = this.db.prepare('SELECT max(id) AS id FROM events').get() as { id: number | null };
  const eventId = id ?? 0;
  if (this.instructionStatusCache?.eventId === eventId) return this.instructionStatusCache.statuses;
  const roles = this.list<Role>('role');
  const statuses = defaultRoles('claude-code', false).flatMap((fallback) => {
    const role = roles.find((saved) => saved.id === fallback.id);
    if (!role || role.retiredAt || !wasSeeded(this, role.id)) return [];
    return [instructionStatus(role, fallback, () => savedInstructions(this, role.id))];
  });
  this.instructionStatusCache = { eventId, statuses };
  return statuses;
}

/**
 * Pure detection for one role. `saved` lazily returns the role's instruction texts from its own
 * event history, newest first; it is read only when the stored text matches no known default.
 */
export function instructionStatus(
  role: Role,
  fallback: Role,
  saved: () => string[],
): DefaultInstructionStatus {
  const history = defaultInstructionHistory[fallback.id] ?? [];
  const revision = instructionRevision(fallback.instructions);
  const common = {
    roleId: role.id,
    revision,
    instructions: fallback.instructions,
    toolDifferences: toolDifferences(role, fallback),
  };
  const known = (text: string) => history.findIndex((entry) => entry.revision === text);
  const after = (index: number) =>
    history
      .slice(index + 1)
      .filter((entry) => !entry.prerelease)
      .map(({ revision, date, summary }) => ({ revision, date, summary }));
  const stored = instructionRevision(role.instructions);
  if (stored === revision) return { ...common, state: 'up_to_date', changes: [] };
  const matched = known(stored);
  if (matched >= 0) return { ...common, state: 'unedited', changes: after(matched) };
  const reviewed = role.defaultInstructionBase;
  if (reviewed && instructionRevision(reviewed.instructions) === reviewed.revision) {
    if (reviewed.revision === revision) return { ...common, state: 'up_to_date', changes: [] };
    const index = known(reviewed.revision);
    if (index >= 0)
      return { ...common, state: 'customized', changes: after(index), base: reviewed };
  }
  for (const text of saved()) {
    const base = instructionRevision(text);
    if (base === revision) return { ...common, state: 'up_to_date', changes: [] };
    const index = known(base);
    if (index >= 0)
      return {
        ...common,
        state: 'customized',
        changes: after(index),
        base: { revision: base, instructions: text },
      };
  }
  return { ...common, state: 'unknown_base', changes: after(-1) };
}

function toolDifferences(role: Role, fallback: Role): (keyof AgentCapabilities)[] {
  const current = { ...defaultCapabilities, ...role.capabilities };
  const expected = { ...defaultCapabilities, ...fallback.capabilities };
  return (Object.keys(defaultCapabilities) as (keyof AgentCapabilities)[]).filter(
    (key) => Boolean(current[key]) !== Boolean(expected[key]),
  );
}

function savedInstructions(context: BoardContext, roleId: string): string[] {
  const rows = context.db
    .prepare(
      "SELECT json FROM events WHERE json_extract(json,'$.kind') = 'role' AND json_extract(json,'$.entityId') = ? ORDER BY id DESC",
    )
    .all(roleId) as { json: string }[];
  return rows.flatMap((row) => {
    const instructions = (decodeEvent(row.json).data as Partial<Role>).instructions;
    return typeof instructions === 'string' ? [instructions] : [];
  });
}

/** A custom role can reserve a default ID before startup; its first event is user-owned. */
function wasSeeded(context: BoardContext, roleId: string): boolean {
  const row = context.db
    .prepare(
      "SELECT json FROM events WHERE json_extract(json,'$.kind') = 'role' AND json_extract(json,'$.entityId') = ? ORDER BY id LIMIT 1",
    )
    .get(roleId) as { json: string } | undefined;
  return !!row && decodeEvent(row.json).actor === 'system';
}
