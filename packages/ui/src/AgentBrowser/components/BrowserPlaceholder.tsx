import type { ReactNode } from 'react';
import type { BrowserControl } from '../types.ts';
import { ClayBrowserPlaceholder } from './ClayBrowserPlaceholder.tsx';

export const BrowserPlaceholder = ({
  loading,
  opened,
  name,
  control,
  children,
}: {
  loading: boolean;
  opened: boolean;
  name?: string;
  control: BrowserControl;
  /** Shown under the action, e.g. recently closed pages. */
  children?: ReactNode;
}) => {
  const manual = !!control.leaseId;
  const act = () => {
    if (!opened) void control.open();
    else if (!manual) void control.take();
    else {
      const address = document.querySelector<HTMLInputElement>(
        '#agent-browser-panel [aria-label="Browser address"]',
      );
      address?.focus();
      address?.select();
    }
  };
  return (
    <ClayBrowserPlaceholder
      {...{ loading, opened, manual, name, act, children }}
      working={control.working}
    />
  );
};
