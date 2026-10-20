import { Button } from '@/components/ui/button/components/Button.tsx';
import type { PacketRulesController } from '../hooks/usePacketRules.ts';

export const RulesActions = ({ controller }: { controller: PacketRulesController }) => (
  <div className="packet-rules-actions flex flex-wrap items-center gap-2">
    <Button type="submit" disabled={!controller.canSave}>
      {controller.working ? 'Saving…' : 'Save rules'}
    </Button>
    {controller.dirty ? (
      <Button variant="outline" onClick={controller.discard}>
        Discard changes
      </Button>
    ) : null}
    <output className="quiet ml-auto" aria-live="polite">
      {controller.checking
        ? 'Checking…'
        : controller.issues.length
          ? `${controller.issues.length} ${controller.issues.length === 1 ? 'problem' : 'problems'} to fix`
          : controller.dirty
            ? 'Unsaved changes'
            : controller.state.error
              ? 'Repair required'
              : `${controller.rules.length} saved rules`}
    </output>
  </div>
);
