import { useState } from 'react';
import { newRule, ruleFormKey, type RuleKind, type RulesDocument } from '../form-helpers.ts';
import { formatRules } from '../helpers.ts';
import type { PacketRulesController } from './usePacketRules.ts';

export const useRuleForm = (document: RulesDocument, controller: PacketRulesController) => {
  const [identity, setIdentity] = useState(() => ({
    text: controller.text,
    ids: document.rules.map((_, position) => position),
    nextId: document.rules.length,
  }));
  if (identity.text !== controller.text) {
    setIdentity({
      text: controller.text,
      ids: document.rules.map((_, position) => identity.nextId + position),
      nextId: identity.nextId + document.rules.length,
    });
  }
  const writeRules = (
    rules: RulesDocument['rules'],
    ids = identity.ids,
    nextId = identity.nextId,
  ) => {
    const text = formatRules({ ...document, rules });
    setIdentity({ text, ids, nextId });
    controller.setText(text);
  };
  const [kind, setKind] = useState<RuleKind>('word_limit');
  const [expanded, setExpanded] = useState<number[]>([]);
  const changeRule = (index: number, patch: Record<string, unknown>) =>
    writeRules(
      document.rules.map((rule, position) => (position === index ? { ...rule, ...patch } : rule)),
    );
  const removeRule = (index: number) => {
    writeRules(
      document.rules.filter((_, position) => position !== index),
      identity.ids.filter((_, position) => position !== index),
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
    writeRules(
      [...document.rules, newRule(kind, document.rules)],
      [...identity.ids, identity.nextId],
      identity.nextId + 1,
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
  return {
    rows: document.rules.map((rule, index) => ({ rule, index, id: identity.ids[index] })),
    kind,
    setKind,
    expanded,
    setExpanded,
    changeRule,
    removeRule,
    addRule,
  };
};
