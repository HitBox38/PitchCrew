import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import type { BrowserControl } from '../types.ts';
import { ClayPageError } from './ClayPageError.tsx';
import { addressParts } from '../helpers.ts';
export const NativeBrowserStatus = ({
  model,
  manual,
  control,
}: {
  model: NativeBrowserModel;
  manual: boolean;
  control: BrowserControl;
}) => {
  const tab = model.state?.tabs.find((item) => item.id === model.state?.activeTab);
  if (!tab?.error) return null;
  return (
    <ClayPageError
      error={tab.error}
      host={addressParts(tab.navigationUrl ?? tab.url)?.host}
      details={tab.errorDetails}
      crashed={!!tab.crashed}
      manual={manual}
      working={control.working}
      reload={() => void model.command({ kind: 'reload' })}
      take={control.available ? undefined : () => void control.take()}
    />
  );
};
