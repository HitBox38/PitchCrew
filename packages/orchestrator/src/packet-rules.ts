import {
  defaultPacketRules,
  packetRuleIssues,
  packetRuleLimits,
  packetRulesSchema,
  type Packet,
  type PacketRuleIssue,
  type PacketRules,
  type PacketRulesState,
  type ProfileFile,
} from '@pitchcrew/core';
import { checkPacket, type PacketCheck } from '@pitchcrew/packet';
import { readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type PacketRulesValidation =
  | { valid: true; rules: PacketRules; issues: [] }
  | { valid: false; issues: PacketRuleIssue[] };

export class PacketRulesError extends Error {
  constructor(readonly issues: PacketRuleIssue[]) {
    super('Fix the packet rule problems before saving.');
  }
}

export function validatePacketRules(input: unknown): PacketRulesValidation {
  const size = Buffer.byteLength(JSON.stringify(input ?? null) ?? '');
  if (size > packetRuleLimits.fileBytes)
    return {
      valid: false,
      issues: [
        {
          path: [],
          message: `Rules files can be at most ${packetRuleLimits.fileBytes / 1024} KB.`,
        },
      ],
    };
  const parsed = packetRulesSchema.safeParse(input);
  return parsed.success
    ? { valid: true, rules: parsed.data, issues: [] }
    : { valid: false, issues: packetRuleIssues(parsed.error) };
}

/**
 * User-owned house rules in packet-rules.json. A missing file means the built-in defaults.
 * An unreadable or invalid file fails closed: every check reports a blocking error.
 */
export class PacketRulesStore {
  readonly path: string;
  private cache?: { key: string; state: PacketRulesState };

  constructor(directory: string) {
    this.path = join(directory, 'packet-rules.json');
  }

  current(): PacketRulesState {
    let key: string;
    try {
      const stat = statSync(this.path);
      key = `${stat.mtimeMs}:${stat.size}`;
      if (stat.size > packetRuleLimits.fileBytes)
        return this.remember(
          key,
          `packet-rules.json is larger than ${packetRuleLimits.fileBytes / 1024} KB.`,
        );
    } catch {
      return { rules: defaultPacketRules, custom: false, error: null };
    }
    if (this.cache?.key === key) return this.cache.state;
    let input: unknown;
    try {
      input = JSON.parse(readFileSync(this.path, 'utf8'));
    } catch {
      return this.remember(key, 'packet-rules.json is not valid JSON.');
    }
    const result = validatePacketRules(input);
    if (!result.valid)
      return this.remember(
        key,
        `packet-rules.json is invalid: ${result.issues
          .slice(0, 3)
          .map((issue) => `${issue.path.join('.') || 'file'}: ${issue.message}`)
          .join('; ')}`,
      );
    this.cache = { key, state: { rules: result.rules, custom: true, error: null } };
    return this.cache.state;
  }

  save(input: unknown): PacketRulesState {
    const result = validatePacketRules(input);
    if (!result.valid) throw new PacketRulesError(result.issues);
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(result.rules, null, 2)}\n`, { mode: 0o600 });
    renameSync(temporary, this.path);
    this.cache = undefined;
    return this.current();
  }

  reset(): PacketRulesState {
    rmSync(this.path, { force: true });
    this.cache = undefined;
    return this.current();
  }

  /** Applies current rules. An invalid rules file adds a blocking error instead of being ignored. */
  check(packet: Packet, profile: ProfileFile[]): PacketCheck {
    const state = this.current();
    const result = checkPacket(packet, profile, state.rules);
    if (!state.error) return result;
    const message = `${state.error} Fix it in Settings before continuing.`;
    return {
      findings: [
        ...result.findings,
        { ruleId: 'packet-rules', severity: 'error', document: 'rules', message },
      ],
      errors: [...result.errors, message],
      warnings: result.warnings,
    };
  }

  private remember(key: string, error: string): PacketRulesState {
    this.cache = { key, state: { rules: defaultPacketRules, custom: true, error } };
    return this.cache.state;
  }
}
