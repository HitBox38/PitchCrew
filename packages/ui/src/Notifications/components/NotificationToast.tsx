import {
  Toast,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastTitle,
  type ToastObject,
} from '@/components/ui/toast/index.tsx';
import { notificationPresentation } from '../constants.ts';
import { NotificationIcon } from './NotificationIcon.tsx';
import type { CrewNotification } from '../types.ts';
import { NotificationLink } from './NotificationLink.tsx';

export function NotificationToast({
  toast,
  onOpen,
}: {
  toast: ToastObject<CrewNotification>;
  onOpen: (item: CrewNotification) => void;
}) {
  const item = toast.data;
  if (!item) return null;
  return (
    <Toast
      toast={toast}
      className="notification-context"
      data-context={item.context}
      data-kind={item.kind}
      swipeDirection={['right', 'down']}
    >
      <ToastContent>
        <NotificationIcon context={item.context} />
        <div className="ui-toast-text">
          <ToastTitle />
          {item.kind === 'attention' ? <ToastDescription /> : null}
          <NotificationLink
            item={item}
            onOpen={onOpen}
            className={`ui-toast-link ${item.kind === 'attention' ? 'button small' : 'text-button'}`}
          >
            {notificationPresentation[item.context].action}
          </NotificationLink>
        </div>
        <ToastClose />
      </ToastContent>
    </Toast>
  );
}
