import { Accordion } from '@/components/ui/accordion/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import { Plus } from 'lucide-react';
import { ruleKinds, type RulesDocument } from '../form-helpers.ts';
import type { PacketRulesController } from '../hooks/usePacketRules.ts';
import { useRuleForm } from '../hooks/useRuleForm.ts';
import { RuleFormItem } from './RuleFormItem.tsx';

export const RuleFormList = ({
  document,
  controller,
}: {
  document: RulesDocument;
  controller: PacketRulesController;
}) => {
  const model = useRuleForm(document, controller);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="form min-w-48 flex-1">
          <FormSelect
            id="new-rule-kind"
            label="Rule type"
            value={model.kind}
            options={ruleKinds}
            onValueChange={model.setKind}
          />
        </div>
        <Button
          id="add-packet-rule"
          variant="outline"
          onClick={model.addRule}
          disabled={controller.working || document.rules.length >= 100}
        >
          <Plus size={15} aria-hidden="true" /> Add rule
        </Button>
      </div>
      {!document.rules.length ? (
        <p className="settings-empty p-5 text-sm">
          No custom rules. Add one above. Exact quotation checks always apply.
        </p>
      ) : null}
      <Accordion
        multiple
        value={model.expanded}
        onValueChange={model.setExpanded}
        className="packet-rule-forms"
      >
        {document.rules.map((rule, index) => (
          <RuleFormItem
            key={index}
            rule={rule}
            index={index}
            change={(patch) => model.changeRule(index, patch)}
            remove={() => model.removeRule(index)}
            issues={controller.issues}
            working={controller.working}
          />
        ))}
      </Accordion>
    </div>
  );
};
