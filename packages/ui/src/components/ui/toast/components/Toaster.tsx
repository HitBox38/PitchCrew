import { Toast as ToastPrimitive, type ToastObject, type ToastManager } from '@base-ui/react/toast';
import type { ReactNode } from 'react';
import { toast, ToastProvider } from '../manager.ts';
import { Toast } from './Toast.tsx';
import { ToastAction, ToastClose } from './ToastActions.tsx';
import { ToastContent, ToastTitle, ToastDescription } from './ToastContent.tsx';
import { ToastPortal, ToastViewport } from './ToastViewport.tsx';

type ToasterProps<Data extends object> = Omit<ToastPrimitive.Provider.Props, 'toastManager'> & {
  toastManager?: ToastManager<Data>;
  renderToast?: (item: ToastObject<Data>) => ReactNode;
};
function ToastList<Data extends object>({ renderToast }: Pick<ToasterProps<Data>, 'renderToast'>) {
  const { toasts } = ToastPrimitive.useToastManager<Data>();
  return toasts.map((item) =>
    renderToast ? (
      renderToast(item)
    ) : (
      <Toast key={item.id} toast={item}>
        <ToastContent>
          <div className="ui-toast-text">
            <ToastTitle />
            <ToastDescription />
          </div>
          {item.actionProps ? <ToastAction /> : null}
          <ToastClose />
        </ToastContent>
      </Toast>
    ),
  );
}
export function Toaster<Data extends object>({
  children,
  toastManager = toast,
  renderToast,
  ...props
}: ToasterProps<Data>) {
  return (
    <ToastProvider toastManager={toastManager} {...props}>
      {children}
      <ToastPortal>
        <ToastViewport>
          <ToastList renderToast={renderToast} />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  );
}
