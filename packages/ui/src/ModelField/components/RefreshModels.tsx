import { Button } from '@/components/ui/button/components/Button.tsx';
import { RefreshCw } from 'lucide-react';

export const RefreshModels = ({ loading, refresh }: { loading: boolean; refresh: () => void }) => {
  return (
    <Button className="text-button" size="xs" variant="ghost" disabled={loading} onClick={refresh}>
      <RefreshCw size={13} aria-hidden="true" className={loading ? 'animate-spin' : undefined} />
      Refresh models
    </Button>
  );
};
