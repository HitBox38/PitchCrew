import { Button } from '@/components/ui/button/components/Button.tsx';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
export const NativeBrowserStatus = ({
  model,
  manual,
}: {
  model: NativeBrowserModel;
  manual: boolean;
}) => {
  const tab = model.state?.tabs.find((item) => item.id === model.state?.activeTab);
  if (tab?.error)
    return (
      <div className="form-error flex items-center justify-between gap-2 px-3 py-2" role="alert">
        <p>{tab.error}</p>
        <Button
          size="sm"
          variant="outline"
          disabled={!manual}
          onClick={() => void model.command({ kind: 'reload' })}
        >
          Retry page
        </Button>
      </div>
    );
  return tab?.loading ? (
    <output className="quiet px-3 py-1" aria-live="polite">
      Loading page…
    </output>
  ) : null;
};
