import type { PacketRuleIssue, PacketRulesState } from '@pitchcrew/core';

export type RuleIssue = PacketRuleIssue;
export type DraftResult = { value: unknown } | { error: string };
export interface RuleView {
  index: number;
  id: string;
  kind: string;
  severity: 'error' | 'warn' | string;
  documents: string;
  detail: string;
}
export interface PacketRulesProps {
  state: PacketRulesState;
}
