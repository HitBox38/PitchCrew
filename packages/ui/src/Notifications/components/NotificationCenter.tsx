import { Toaster } from '@pitchcrew/design-system/toast';
import { useNotifications } from '../hooks/useNotifications.ts';
import { openNotification } from '../open.ts';
import { ActionToast } from './ActionToast.tsx';
import { DialogToasts } from './DialogToasts.tsx';
import { NotificationToast } from './NotificationToast.tsx';

/**
 * The single toast stack, sounds and alert tracking, kept clear of open dialogs' footers. Mount once
 * in the workspace shell.
 */
export const NotificationCenter = () => {
  const { toastManager } = useNotifications();
  return (
    <Toaster
      toastManager={toastManager}
      limit={3}
      renderToast={(toast) =>
        toast.data ? (
          <NotificationToast key={toast.id} toast={toast} onOpen={openNotification} />
        ) : (
          <ActionToast key={toast.id} toast={toast} />
        )
      }
    >
      <DialogToasts />
    </Toaster>
  );
};
