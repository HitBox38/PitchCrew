import { z } from 'zod';
import type { AgentCapabilities } from './roles.ts';
import type { RoleId } from './states.ts';

/** One shipped default instruction text for a seeded role, identified by its content hash. */
export interface DefaultInstructionRevision {
  /** First 16 hex characters of the SHA-256 of the whitespace-normalized text. */
  revision: string;
  /** Release date of this text, YYYY-MM-DD. */
  date: string;
  /** One plain sentence about what this revision changed. */
  summary: string;
}

/**
 * - `up_to_date`: stored text matches the current default, or the user edited the current default.
 * - `unedited`: stored text matches an earlier default.
 * - `customized`: the user edited an earlier default (recorded source or role event history).
 * - `unknown_base`: the text matches no known default; treated like `customized`.
 */
export type DefaultInstructionState = 'up_to_date' | 'unedited' | 'customized' | 'unknown_base';

export interface DefaultInstructionStatus {
  roleId: RoleId;
  state: DefaultInstructionState;
  /** Revision of the current default text. */
  revision: string;
  /** The current default text. */
  instructions: string;
  /** Changelog entries newer than the matched base, oldest first. */
  changes: DefaultInstructionRevision[];
  /** The exact earlier default a customized role was edited from, when known. */
  base?: { revision: string; instructions: string };
  /** Tools whose saved setting differs from the current default. Mentioned only; never changed. */
  toolDifferences: (keyof AgentCapabilities)[];
}

/** A default role whose instructions have a newer default. Only the user can act on it. */
export interface InstructionUpdate extends DefaultInstructionStatus {
  state: Exclude<DefaultInstructionState, 'up_to_date'>;
  /** The user chose Keep mine for this revision. A newer revision clears it. */
  dismissed: boolean;
}

export const defaultInstructionRevisionId = z.string().regex(/^[a-f0-9]{16}$/);

export const instructionUpdateDecision = z
  .object({ revision: defaultInstructionRevisionId })
  .strict();
