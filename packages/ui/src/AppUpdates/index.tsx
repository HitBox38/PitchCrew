import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { X } from 'lucide-react';
import { useRef } from 'react';
import { AppUpdateButton } from './components/AppUpdateButton.tsx';
import { useUpdateControl } from './hooks/useUpdateControl.ts';

export const AppUpdates = () => {
  const control = useUpdateControl();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <SidebarMenuItem className="ml-auto shrink-0 group-data-[collapsible=icon]:ml-0">
      <div className="relative flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
        <AppUpdateButton control={control} trigger={trigger} />
        {control.visible ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label="Dismiss update notice"
            title="Dismiss for this session"
            disabled={control.busy || control.checking}
            onClick={() => {
              control.dismiss();
              trigger.current?.focus();
            }}
          >
            <X aria-hidden="true" className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <output className="sr-only" aria-live="polite">
        {control.visible || control.checking ? `${control.label}. ${control.message ?? ''}` : ''}
      </output>
    </SidebarMenuItem>
  );
};
