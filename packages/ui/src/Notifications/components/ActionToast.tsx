import { CheckCircle2, CircleAlert, Info } from 'lucide-react';
import {
  Toast,
  ToastClose,
  ToastContent,
  ToastTitle,
  type ToastObject,
} from '@/components/ui/toast/index.tsx';
import type { CrewNotification } from '../types.ts';
export function ActionToast({ toast }: { toast: ToastObject<CrewNotification> }) {
  const Icon =
    toast.type === 'error' ? CircleAlert : toast.type === 'success' ? CheckCircle2 : Info;
  return (
    <Toast
      toast={toast}
      data-kind="action"
      data-tone={toast.type}
      swipeDirection={['right', 'down']}
    >
      <ToastContent>
        <Icon size={18} aria-hidden="true" />
        <div className="ui-toast-text">
          <ToastTitle />
        </div>
        <ToastClose />
      </ToastContent>
    </Toast>
  );
}
