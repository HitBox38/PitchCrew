import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet/index.tsx';
import { Toaster } from '@/components/ui/toast/index.tsx';
import { Bell } from 'lucide-react';
import { NotificationControls } from './components/NotificationControls.tsx';
import { NotificationToast } from './components/NotificationToast.tsx';
import { NotificationList } from './components/NotificationList.tsx';
import { useNotifications } from './hooks/useNotifications.ts';

export function Notifications() {
  const state = useNotifications();
  return (
    <Toaster
      toastManager={state.toastManager}
      limit={3}
      renderToast={(toast) => (
        <NotificationToast key={toast.id} toast={toast} onOpen={state.openNotification} />
      )}
    >
      <Sheet open={state.open} onOpenChange={state.setOpen}>
        <SheetTrigger
          render={
            <Button
              className="icon-button notification-bell"
              aria-label={`Notifications, ${state.unread.length} unread`}
            />
          }
        >
          <Bell size={17} />
          {state.unread.length ? (
            <span className="notification-count">{state.unread.length}</span>
          ) : null}
        </SheetTrigger>
        <SheetContent className="notification-panel">
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>
              Messages from your crew and requests for your attention.
            </SheetDescription>
          </SheetHeader>
          <NotificationControls
            preferences={state.preferences}
            onPreferences={state.setPreferences}
            unread={state.unread.length}
            onReadAll={() => state.markRead(state.items.map((item) => item.id))}
          />
          <NotificationList items={state.items} read={state.read} onOpen={state.openNotification} />
        </SheetContent>
      </Sheet>
    </Toaster>
  );
}
