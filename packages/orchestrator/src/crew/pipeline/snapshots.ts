import { digestPacket } from '@pitchcrew/board';
import type { Card, Role, Run, Skill } from '@pitchcrew/core';
import { createHash } from 'node:crypto';

// Recursively sort keys so config identity is independent of object property order.
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
}
export function configRevision(role: Role): string {
  return createHash('sha256')
    .update(JSON.stringify(stable(role)))
    .digest('hex');
}
export function runConfiguration(role: Role, skills: Skill[]): Run['configuration'] {
  return {
    role: structuredClone(role),
    revision: configRevision(role),
    skills: structuredClone(skills),
    skillsRevision: createHash('sha256')
      .update(JSON.stringify(stable(skills)))
      .digest('hex'),
  };
}
export function packetDigest(card: Card | null): string | null {
  return card?.packet ? digestPacket(card.id, card.packet) : null;
}
