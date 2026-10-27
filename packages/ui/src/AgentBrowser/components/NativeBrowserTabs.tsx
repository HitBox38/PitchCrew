import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
export const NativeBrowserTabs = ({
  model,
  manual,
}: {
  model: NativeBrowserModel;
  manual: boolean;
}) => (
  <div
    className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-1"
    aria-label="Browser tabs"
  >
    {model.state?.tabs.map((item) => (
      <div key={item.id} className="flex shrink-0 items-center gap-0.5">
        <Button
          size="sm"
          variant={item.id === model.state?.activeTab ? 'secondary' : 'ghost'}
          disabled={!manual}
          aria-current={item.id === model.state?.activeTab ? 'page' : undefined}
          onClick={() => void model.command({ kind: 'select-tab', tabId: item.id })}
        >
          <span className="max-w-40 truncate">{item.title || 'New tab'}</span>
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Close ${item.title || 'tab'}`}
          disabled={!manual}
          onClick={() => void model.command({ kind: 'close-tab', tabId: item.id })}
        >
          <X size={12} />
        </Button>
      </div>
    ))}
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="New browser tab"
      disabled={!manual}
      onClick={() =>
        void model.command({ kind: 'new-tab' }).then(() => {
          const address = document.querySelector<HTMLInputElement>(
            '[aria-label="Browser address"]',
          );
          address?.focus();
          address?.select();
        })
      }
    >
      <Plus size={14} />
    </Button>
  </div>
);
