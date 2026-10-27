import { useCallback } from 'react';
import { BrowserDialog } from './BrowserDialog.tsx';
import { NativeBrowserToolbar } from './NativeBrowserToolbar.tsx';
import { NativeBrowserTabs } from './NativeBrowserTabs.tsx';
import { NativeBrowserFind } from './NativeBrowserFind.tsx';
import { useNativeMount } from '../hooks/useNativeMount.ts';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import type { BrowserControl } from '../types.ts';
import type { useBrowserSize } from '../hooks/useBrowserSize.ts';
export const NativeBrowser = ({
  model,
  control,
  viewport,
}: {
  model: NativeBrowserModel;
  control: BrowserControl;
  viewport: ReturnType<typeof useBrowserSize>;
}) => {
  const id = model.identity!.id;
  const mount = useNativeMount(id);
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
      {model.findOpen ? (
        <NativeBrowserFind key={id} id={id} close={() => model.setFindOpen(false)} />
      ) : null}
      {!manual ? (
        <p className="quiet px-3 py-1">
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
        <div className="browser-live-view" ref={attach} aria-label="Native browser page" />
      </div>
    </>
  );
};
