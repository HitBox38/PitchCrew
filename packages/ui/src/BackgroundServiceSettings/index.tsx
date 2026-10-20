import { Button } from '@/components/ui/button/components/Button.tsx';
import { RefreshCw } from 'lucide-react';
import { ServiceState } from './components/ServiceState.tsx';
import { useBackgroundService } from './hooks/useBackgroundService.ts';

export const BackgroundServiceSettings = () => {
  const { info, error, loading, installing, checkAgain, install } = useBackgroundService();
  return (
    <section className="settings-section" aria-labelledby="background-service-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="background-service-heading">Background service</h2>
        <Button className="button" disabled={loading || installing} onClick={checkAgain}>
          <RefreshCw size={15} /> Check again
        </Button>
      </div>
      <p className="quiet">
        Starts the daemon when you log in, so routines run without an open window.
      </p>
      {error ? (
        <p className="info-note" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <ServiceState
          info={info}
          installing={installing}
          disabled={loading || installing}
          install={install}
        />
      ) : null}
      {!info && !error ? <p className="info-note">Checking the background service.</p> : null}
    </section>
  );
};
