import { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { PacketRulesController } from '../hooks/usePacketRules.ts';
import { RestoreDefaults } from './RestoreDefaults.tsx';

export const RuleFileActions = ({ controller }: { controller: PacketRulesController }) => {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="mt-5 border-t border-border pt-5">
      <h3 className="mb-2">Rules files</h3>
      <p className="quiet mb-3">
        Import a file for review, or export your saved rules as a backup.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={controller.working}
          onClick={() => controller.guard.requestLeave(() => input.current?.click())}
        >
          <Upload size={15} aria-hidden="true" /> Import file
        </Button>
        <input
          ref={input}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          tabIndex={-1}
          aria-label="Import packet rules file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void controller.importFile(file);
          }}
        />
        <Button variant="outline" size="sm" onClick={controller.exportFile}>
          <Download size={15} aria-hidden="true" /> Export saved rules
        </Button>
        {controller.state.custom ? (
          <RestoreDefaults
            disabled={controller.working}
            onConfirm={() => controller.guard.requestLeave(controller.restoreDefaults)}
          />
        ) : null}
      </div>
    </div>
  );
};
