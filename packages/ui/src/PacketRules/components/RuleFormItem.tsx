import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion/index.tsx';
import { fieldText, ruleFormKey } from '../form-helpers.ts';
import { documentLabels, kindLabels } from '../constants.ts';
import { ruleDetail, issuesForRule } from '../helpers.ts';
import { RuleForm } from './RuleForm.tsx';
import type { ComponentProps } from 'react';

export const RuleFormItem = (props: ComponentProps<typeof RuleForm>) => {
  const { rule, index } = props;
  const problems = issuesForRule(props.issues, index);
  return (
    <AccordionItem value={index} data-invalid={problems.length > 0 || undefined}>
      <AccordionTrigger id={ruleFormKey(index, 'trigger')} className="px-4 py-4">
        <span className="min-w-0 space-y-1">
          <span className="block font-semibold wrap-anywhere">
            {kindLabels[rule.kind]}
            {Array.isArray(rule.documents) && rule.documents.length
              ? ` for ${rule.documents.map((value) => documentLabels[String(value)] ?? String(value)).join(', ')}`
              : ''}
          </span>
          <span className="quiet block">{ruleDetail(rule)}</span>
        </span>
        <span className={`badge ml-auto shrink-0 packet-rule-${fieldText(rule.severity)}`}>
          {problems.length
            ? `${problems.length} to fix`
            : rule.severity === 'error'
              ? 'Blocks packet'
              : 'Warning'}
        </span>
      </AccordionTrigger>
      <AccordionContent keepMounted className="px-4 pb-5">
        <RuleForm {...props} />
      </AccordionContent>
    </AccordionItem>
  );
};
