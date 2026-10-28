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
      <div className="browser-page-error" role="alert">
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
  return null;
};
