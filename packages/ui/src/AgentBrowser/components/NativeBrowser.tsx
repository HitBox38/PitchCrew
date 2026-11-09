import { NativeBrowserTools } from '@/NativeBrowserTools/index.tsx';
import { useNativeBrowserTools } from '@/NativeBrowserTools/hooks/useNativeBrowserTools.ts';
import { BrowserDeviceToolbar } from '@/BrowserDeviceToolbar/index.tsx';
import type { useBrowserDevice } from '@/BrowserDeviceToolbar/useBrowserDevice.ts';
import { useCallback } from 'react';
import { BrowserDialog } from './BrowserDialog.tsx';
import { NativeBrowserToolbar } from './NativeBrowserToolbar.tsx';
import { useNativeMount } from '../hooks/useNativeMount.ts';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import type { BrowserControl } from '../types.ts';
import type { useBrowserSize } from '../hooks/useBrowserSize.ts';
import { isBlankBrowserPage } from '../page-state.ts';
import { NativeBrowserBody } from './NativeBrowserBody.tsx';
import { BrowserWarning } from './BrowserWarning.tsx';
export const NativeBrowser = ({
  model,
  control,
  viewport,
  device,
  onAttachBrowserFile,
  name,
}: {
  model: NativeBrowserModel;
  control: BrowserControl;
  viewport: ReturnType<typeof useBrowserSize>;
  device: ReturnType<typeof useBrowserDevice>;
  onAttachBrowserFile?: (file: File) => void;
  /** The agent's name for the control hint and empty page. */
  name?: string;
}) => {
  const id = model.identity!.id;
  const tab = model.state?.tabs.find((item) => item.id === model.state?.activeTab);
  const empty = !tab?.loading && !tab?.error && isBlankBrowserPage(tab?.url, tab?.title);
  const mount = useNativeMount(id, !!model.state && !tab?.error && (!!tab?.window || !empty));
  const attachViewport = viewport.attach;
  const attach = useCallback(
    (element: HTMLDivElement | null) => {
      const unmount = mount(element);
      const detach = attachViewport(element);
      return () => {
        unmount?.();
        detach?.();
      };
    },
    [mount, attachViewport],
  );
  // Usable while holding control, or while the agent is idle (the first action takes control).
  const usable = control.available && !control.working;
  const tools = useNativeBrowserTools(model, control);
  return (
    <>
      {/* Toolbar and tools share one row; Page settings holds the page tools. */}
      <div className="browser-chrome">
        <NativeBrowserToolbar model={model} control={control} tools={tools} device={device} />
        <NativeBrowserTools
          tools={tools}
          device={device}
          onAttachBrowserFile={onAttachBrowserFile}
        />
      </div>
      {device.open ? (
        <BrowserDeviceToolbar
          setting={device.setting}
          change={device.setSetting}
          close={() => device.setOpen(false)}
          disabled={!usable}
        />
      ) : null}
      <BrowserWarning warning={model.state?.warning} control={control} />
      {model.state?.dialog ? (
        <BrowserDialog
          key={`${model.state.dialog.type}:${model.state.dialog.message}`}
          dialog={model.state.dialog}
          control={control}
        />
      ) : null}
      <NativeBrowserBody
        model={model}
        control={control}
        attach={attach}
        empty={empty}
        name={name}
      />
    </>
  );
};
