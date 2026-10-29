import { NativeBrowserTools } from '@/NativeBrowserTools/index.tsx';
import { BrowserDeviceToolbar } from '@/BrowserDeviceToolbar/index.tsx';
import type { useBrowserDevice } from '@/BrowserDeviceToolbar/useBrowserDevice.ts';
import { NativeBrowserStatus } from './NativeBrowserStatus.tsx';
import { useCallback } from 'react';
import { BrowserDialog } from './BrowserDialog.tsx';
import { NativeBrowserToolbar } from './NativeBrowserToolbar.tsx';
import { NativeBrowserTabs } from './NativeBrowserTabs.tsx';
import { NativeBrowserFind } from './NativeBrowserFind.tsx';
import { useNativeMount } from '../hooks/useNativeMount.ts';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import type { BrowserControl } from '../types.ts';
import type { useBrowserSize } from '../hooks/useBrowserSize.ts';
import { BrowserPlaceholder } from './BrowserPlaceholder.tsx';
import { isBlankBrowserPage } from '../page-state.ts';
import { BrowserPopup } from './BrowserPopup.tsx';
export const NativeBrowser = ({
  model,
  control,
  viewport,
  device,
  onAttachBrowserFile,
}: {
  model: NativeBrowserModel;
  control: BrowserControl;
  viewport: ReturnType<typeof useBrowserSize>;
  device: ReturnType<typeof useBrowserDevice>;
  onAttachBrowserFile?: (file: File) => void;
}) => {
  const id = model.identity!.id;
  const tab = model.state?.tabs.find((item) => item.id === model.state?.activeTab);
  const empty = !tab?.loading && !tab?.error && isBlankBrowserPage(tab?.url, tab?.title);
  const mount = useNativeMount(id, !!model.state && !tab?.error && (!!tab?.window || !empty));
  const attachViewport = viewport.attach;
  const attach = useCallback(
    (element: HTMLDivElement | null) => {
      mount(element);
      attachViewport(element);
    },
    [mount, attachViewport],
  );
  const manual = !!control.leaseId;
  return (
    <>
      <NativeBrowserTabs model={model} manual={manual && !control.working} />
      <NativeBrowserToolbar model={model} control={control} />
      <NativeBrowserTools
        model={model}
        control={control}
        device={device}
        onAttachBrowserFile={onAttachBrowserFile}
      />
      {device.open ? (
        <BrowserDeviceToolbar
          setting={device.setting}
          change={device.setSetting}
          close={() => device.setOpen(false)}
          disabled={!manual || control.working}
        />
      ) : null}
      {model.findOpen ? (
        <NativeBrowserFind key={id} id={id} close={() => model.setFindOpen(false)} />
      ) : null}
      {!manual ? (
        <p className="browser-control-hint">
          Take control to browse. Your agent pauses while you use the page.
        </p>
      ) : null}
      {model.state?.warning ? <p className="browser-dialog">{model.state.warning}</p> : null}
      {model.state?.dialog ? (
        <BrowserDialog
          key={`${model.state.dialog.type}:${model.state.dialog.message}`}
          dialog={model.state.dialog}
          control={control}
        />
      ) : null}
      <div className="browser-panel-body">
        <div className="browser-live-view" ref={attach} aria-label="Native browser page">
          <NativeBrowserStatus model={model} manual={manual && !control.working} />
          {tab?.window ? (
            <BrowserPopup model={model} tabId={tab.id} manual={manual && !control.working} />
          ) : !model.state || empty ? (
            <BrowserPlaceholder loading={!model.state} opened control={control} />
          ) : null}
        </div>
      </div>
    </>
  );
};
