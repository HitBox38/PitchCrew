import { Button } from '@/components/ui/button/components/Button.tsx';
import type { PacketRulesController } from '../hooks/usePacketRules.ts';

export const RulesActions = ({ controller }: { controller: PacketRulesController }) => {
  const problems = controller.issues.length;
  return (
    <div className="packet-rules-actions ui-footer-bar">
      <output
        className="ui-footer-note"
        data-problem={problems || controller.state.error ? '' : undefined}
        aria-live="polite"
      >
        {controller.checking
          ? 'Checking…'
          : problems
            ? `${problems} ${problems === 1 ? 'problem' : 'problems'} to fix before saving`
            : controller.dirty
              ? 'Unsaved changes'
              : controller.state.error
                ? 'Repair required'
                : `${controller.rules.length} saved rules`}
      </output>
      {controller.dirty ? (
        <Button variant="ghost" onClick={controller.discard}>
          Discard changes
        </Button>
      ) : null}
      <Button type="submit" disabled={!controller.canSave}>
        {controller.working ? 'Saving…' : 'Save rules'}
      </Button>
    </div>
  );
};
