import { PopoverTrigger } from '@pitchcrew/design-system/popover';
import { Download, RotateCw } from 'lucide-react';
import type { RefObject } from 'react';
import type { useUpdateControl } from '../hooks/useUpdateControl.ts';

/** A stable icon target; download progress stays visible without a second toolbar row. */
export const AppUpdateButton = ({
  control,
  trigger,
}: {
  control: ReturnType<typeof useUpdateControl>;
  trigger: RefObject<HTMLButtonElement | null>;
}) => {
  const Icon = control.ready ? RotateCw : Download;
  return (
    <PopoverTrigger
      ref={trigger}
      type="button"
      aria-label={`Pitchcrew update: ${control.label}`}
      title={control.label}
      aria-busy={control.busy || control.checking}
      className="app-update-button"
      data-ready={control.ready ? '' : undefined}
    >
      {control.progress !== null ? (
        <span
          aria-hidden="true"
          className="app-update-progress"
          style={{ width: `${control.progress}%` }}
        />
      ) : null}
      <Icon aria-hidden="true" />
      {control.progress === null ? <span className="app-update-dot" aria-hidden="true" /> : null}
    </PopoverTrigger>
  );
};
