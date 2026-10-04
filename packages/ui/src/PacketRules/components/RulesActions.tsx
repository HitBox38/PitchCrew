import { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { PacketRulesController } from '../hooks/usePacketRules.ts';
import { RestoreDefaults } from './RestoreDefaults.tsx';

export function RulesActions({ controller }: { controller: PacketRulesController }) {
  const input = useRef<HTMLInputElement>(null);
  const { canSave, dirty, working, state, guard } = controller;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2.5">
      <Button type="submit" className="button primary" disabled={!canSave}>
        {working ? 'Saving…' : 'Save rules'}
      </Button>
      {dirty ? (
        <Button className="button" onClick={controller.discard}>
          Discard changes
        </Button>
      ) : null}
      <Button className="button" onClick={() => guard.requestLeave(() => input.current?.click())}>
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
      <Button className="button" onClick={controller.exportFile}>
        <Download size={15} aria-hidden="true" /> Export saved rules
      </Button>
      {state.custom ? (
        <RestoreDefaults
          disabled={working}
          onConfirm={() => guard.requestLeave(controller.restoreDefaults)}
        />
      ) : null}
    </div>
  );
}
