import { useRef, useState } from 'react';
import { Download, Ellipsis, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu/index.tsx';
import type { PacketRulesController } from '../hooks/usePacketRules.ts';
import { RestoreDefaults } from './RestoreDefaults.tsx';

/** Import, export and reset live in the header overflow; reset still confirms. */
export const RuleFileActions = ({ controller }: { controller: PacketRulesController }) => {
  const input = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon-sm" aria-label="Rules file actions" />}
        >
          <Ellipsis size={15} aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={controller.working}
              onClick={() => controller.guard.requestLeave(() => input.current?.click())}
            >
              <Upload aria-hidden="true" /> Import file…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={controller.exportFile}>
              <Download aria-hidden="true" /> Export saved rules
            </DropdownMenuItem>
            {controller.state.custom ? (
              <DropdownMenuItem disabled={controller.working} onClick={() => setRestoring(true)}>
                <RotateCcw aria-hidden="true" /> Restore defaults…
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
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
      <RestoreDefaults
        open={restoring}
        setOpen={setRestoring}
        onConfirm={() => controller.guard.requestLeave(controller.restoreDefaults)}
      />
    </>
  );
};
