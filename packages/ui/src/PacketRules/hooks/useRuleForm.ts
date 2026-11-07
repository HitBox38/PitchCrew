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
  const [chosen, setSelected] = useState(0);
  const selectRule = (index: number) => {
    setSelected(index);
    requestAnimationFrame(() => {
      const editor = window.document.getElementById(ruleFormKey(index, 'editor'));
      const list = editor?.closest('.packet-rules-panes')?.firstElementChild;
      if (
        editor &&
        list &&
        editor.getBoundingClientRect().top > list.getBoundingClientRect().bottom
      ) {
        editor.focus({ preventScroll: true });
        editor.scrollIntoView({ block: 'start', inline: 'nearest' });
      }
    });
  };
  const selected = document.rules.length ? Math.min(chosen, document.rules.length - 1) : null;
  const changeRule = (index: number, patch: Record<string, unknown>) =>
    writeRules(
      document.rules.map((rule, position) => (position === index ? { ...rule, ...patch } : rule)),
    );
  const removeRule = (index: number) => {
    writeRules(
      document.rules.filter((_, position) => position !== index),
      identity.ids.filter((_, position) => position !== index),
    );
    setSelected((current) =>
      current > index ? current - 1 : Math.min(current, document.rules.length - 2),
    );
    requestAnimationFrame(() => {
      const target =
        window.document.getElementById(
          document.rules.length > 1
            ? ruleFormKey(Math.min(index, document.rules.length - 2), 'trigger')
            : 'add-packet-rule',
        ) ?? window.document.getElementById('selected-packet-rule');
      target?.focus();
    });
  };
  const addRule = () => {
    writeRules(
      [...document.rules, newRule(kind, document.rules)],
      [...identity.ids, identity.nextId],
      identity.nextId + 1,
    );
    setSelected(document.rules.length);
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
    selected,
    setSelected: selectRule,
    changeRule,
    removeRule,
    addRule,
  };
};
