import { Button } from '@/components/ui/button/components/Button.tsx';
import { RefreshCw } from 'lucide-react';
import { ServiceState } from './components/ServiceState.tsx';
import { useBackgroundService } from './hooks/useBackgroundService.ts';

export function BackgroundServiceSettings() {
  const { info, error, loading, checkAgain } = useBackgroundService();
  return (
    <section className="settings-section" aria-labelledby="background-service-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="background-service-heading">Background service</h2>
        <Button className="button" disabled={loading} onClick={checkAgain}>
          <RefreshCw size={15} /> Check again
        </Button>
      </div>
      <p className="quiet">
        Starts the daemon when you log in, so routines run without an open window.
      </p>
      {error ? <p className="info-note">{error}</p> : null}
      {info ? <ServiceState info={info} /> : null}
      {!info && !error ? <p className="info-note">Checking the background service.</p> : null}
    </section>
  );
}
