import { useState } from 'react';
import { newRule, ruleFormKey, type RuleKind, type RulesDocument } from '../form-helpers.ts';
import { formatRules } from '../helpers.ts';
import type { PacketRulesController } from './usePacketRules.ts';

export const useRuleForm = (document: RulesDocument, controller: PacketRulesController) => {
  const [kind, setKind] = useState<RuleKind>('word_limit');
  const [expanded, setExpanded] = useState<number[]>([]);
  const changeRule = (index: number, patch: Record<string, unknown>) =>
    controller.setText(
      formatRules({
        ...document,
        rules: document.rules.map((rule, position) =>
          position === index ? { ...rule, ...patch } : rule,
        ),
      }),
    );
  const removeRule = (index: number) => {
    controller.setText(
      formatRules({
        ...document,
        rules: document.rules.filter((_, position) => position !== index),
      }),
    );
    setExpanded((current) =>
      current
        .filter((position) => position !== index)
        .map((position) => (position > index ? position - 1 : position)),
    );
    requestAnimationFrame(() =>
      window.document
        .getElementById(
          document.rules.length > 1
            ? ruleFormKey(Math.min(index, document.rules.length - 2), 'trigger')
            : 'add-packet-rule',
        )
        ?.focus(),
    );
  };
  const addRule = () => {
    controller.setText(
      formatRules({ ...document, rules: [...document.rules, newRule(kind, document.rules)] }),
    );
    setExpanded((current) => [...current, document.rules.length]);
    const field =
      kind === 'word_limit' || kind === 'max_bullets'
        ? 'max'
        : kind === 'canonical_lines'
          ? 'selector'
          : 'pattern';
    requestAnimationFrame(() =>
      window.document.getElementById(ruleFormKey(document.rules.length, field))?.focus(),
    );
  };
  return { kind, setKind, expanded, setExpanded, changeRule, removeRule, addRule };
};
