import type { WorkspaceNotificationProps } from '@/App/types.ts';
import { workspaceToasts } from '@/Notifications/toasts.ts';
import { useEffect } from 'react';

export function WorkspaceNotification({ toast, toastType, setToast }: WorkspaceNotificationProps) {
  useEffect(() => {
    if (!toast) return;
    workspaceToasts.add({
      title: toast,
      type: toastType,
      timeout: toastType === 'error' ? 10000 : 5000,
    });
    setToast('');
  }, [toast, toastType, setToast]);
  return null;
}
