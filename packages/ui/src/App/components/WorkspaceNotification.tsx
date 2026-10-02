import type { WorkspaceNotificationProps } from '@/App/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { X } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';

export function WorkspaceNotification({
  toast,
  reduced,
  selectedRole,
  setToast,
}: WorkspaceNotificationProps) {
  return (
    <AnimatePresence>
      {toast ? (
        <m.output
          key="notification"
          initial={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reduced ? 0 : 8 }}
          className={`toast ${selectedRole ? 'toast-above-settings' : ''}`}
        >
          <span>{toast}</span>
          <Button
            className="icon-button"
            onClick={() => setToast('')}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </Button>
        </m.output>
      ) : null}
    </AnimatePresence>
  );
}
