import { Button } from '@pitchcrew/design-system/button';
import { FormSelect } from '@/FormSelect/index.tsx';
import { Plus } from 'lucide-react';
import { ruleKinds, type RulesDocument } from '../form-helpers.ts';
import type { PacketRulesController } from '../hooks/usePacketRules.ts';
import { useRuleForm } from '../hooks/useRuleForm.ts';
import { RuleForm } from './RuleForm.tsx';
import { RuleListItem } from './RuleListItem.tsx';
import { RulePicker } from './RulePicker.tsx';
import { useContext } from 'react';
import { SettingsCompact } from '@/SettingsPage/layout-context.ts';

/** A 280px rule list beside the selected rule's form. */
export const RuleFormList = ({
  document,
  controller,
}: {
  document: RulesDocument;
  controller: PacketRulesController;
}) => {
  const model = useRuleForm(document, controller);
  const compact = useContext(SettingsCompact);
  const current = model.selected === null ? undefined : model.rows[model.selected];
  return (
    <div className="packet-rules-panes">
      <div className="packet-rules-list ui-tray">
        {compact && model.rows.length ? (
          <RulePicker rows={model.rows} selected={model.selected} select={model.setSelected} />
        ) : model.rows.length ? (
          <ul aria-label="Packet rules">
            {model.rows.map(({ rule, index, id }) => (
              <RuleListItem
                key={id}
                rule={rule}
                index={index}
                issues={controller.issues}
                selected={index === model.selected}
                select={() => model.setSelected(index)}
              />
            ))}
          </ul>
        ) : (
          <p className="quiet">No custom rules. Exact quotation checks always apply.</p>
        )}
        <div className="packet-rules-add form">
          <FormSelect
            id="new-rule-kind"
            label="New rule type"
            value={model.kind}
            options={ruleKinds}
            onValueChange={model.setKind}
          />
          <Button
            id="add-packet-rule"
            variant="outline"
            size="sm"
            onClick={model.addRule}
            disabled={controller.working || document.rules.length >= 100}
          >
            <Plus size={14} aria-hidden="true" /> Add rule
          </Button>
        </div>
      </div>
      <div className="packet-rules-detail">
        {current ? (
          <RuleForm
            key={current.id}
            rule={current.rule}
            index={current.index}
            change={(patch) => model.changeRule(current.index, patch)}
            remove={() => model.removeRule(current.index)}
            issues={controller.issues}
            working={controller.working}
          />
        ) : (
          <p className="ui-empty">Choose a rule type and add your first rule.</p>
        )}
      </div>
    </div>
  );
};
