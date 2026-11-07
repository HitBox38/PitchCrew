import { FormSelect } from '@/FormSelect/index.tsx';
import { ruleSentence } from '../helpers.ts';
import type { RuleDraft } from '../form-helpers.ts';

export const RulePicker = ({
  rows,
  selected,
  select,
}: {
  rows: { rule: RuleDraft; index: number }[];
  selected: number | null;
  select: (index: number) => void;
}) => (
  <FormSelect
    id="selected-packet-rule"
    label="Rule to edit"
    value={String(selected ?? 0)}
    options={rows.map(({ rule, index }) => ({ value: String(index), label: ruleSentence(rule) }))}
    onValueChange={(value) => select(Number(value))}
  />
);
