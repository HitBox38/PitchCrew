import { AlertCircle } from 'lucide-react';
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
        <AlertCircle size={28} aria-hidden="true" />
        <h3>Unable to open this page</h3>
        <p>{tab.error}</p>
        <p className="quiet">Check the address or try loading it again.</p>
        <Button
          size="sm"
          variant="outline"
          disabled={!manual}
          onClick={() => void model.command({ kind: 'reload' })}
        >
          Retry page
        </Button>
        {!manual ? <p className="quiet">Take control to retry or enter another address.</p> : null}
      </div>
    );
  return null;
};
