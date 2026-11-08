import { useState } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortableOperation } from '@dnd-kit/react/sortable';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import { useBrowserTabOrder } from '../hooks/useBrowserTabOrder.ts';
import { browserTabLabel, moveTabFocus } from '../helpers.ts';
import { browserTabModifiers, browserTabPlugins, browserTabSensors } from '../tab-drag.ts';
import { NativeBrowserNewTab } from './NativeBrowserNewTab.tsx';
import { NativeBrowserTab } from './NativeBrowserTab.tsx';

export const NativeBrowserTabs = ({
  model,
  manual,
}: {
  model: NativeBrowserModel;
  manual: boolean;
}) => {
  const order = useBrowserTabOrder(model);
  const [announcement, setAnnouncement] = useState('');
  const count = order.tabs.length;
  return (
    <div className="browser-tab-strip">
      <DragDropProvider
        sensors={browserTabSensors}
        plugins={browserTabPlugins}
        modifiers={browserTabModifiers}
        onDragEnd={({ operation, canceled }) => {
          if (!canceled && operation.target && isSortableOperation(operation) && operation.source)
            order.move(String(operation.source.id), operation.source.index);
        }}
      >
        <div
          className="browser-tabs"
          role="tablist"
          aria-label="Browser tabs"
          tabIndex={-1}
          onKeyDown={moveTabFocus}
        >
          {order.tabs.map((tab, index) => (
            <NativeBrowserTab
              key={tab.id}
              model={model}
              tab={tab}
              index={index}
              count={count}
              manual={manual}
              move={(next) => {
                if (next < 0 || next >= count || !order.move(tab.id, next)) return;
                setAnnouncement(`Moved ${browserTabLabel(tab)}. Position ${next + 1} of ${count}.`);
              }}
            />
          ))}
        </div>
      </DragDropProvider>
      <output className="sr-only" aria-live="polite">
        {announcement}
      </output>
      <NativeBrowserNewTab model={model} manual={manual} />
    </div>
  );
};
