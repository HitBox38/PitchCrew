import { Button } from '@pitchcrew/design-system/button';
import { RefreshCw } from 'lucide-react';
import { SettingsSection } from '@/SettingsPage/components/SettingsSection.tsx';
import { ServiceState } from './components/ServiceState.tsx';
import { useBackgroundService } from './hooks/useBackgroundService.ts';

export const BackgroundServiceSettings = () => {
  const { info, error, loading, installing, checkAgain, install } = useBackgroundService();
  return (
    <SettingsSection
      id="background-service-heading"
      title="Background service"
      description="Starts Pitchcrew when you log in, so routines run without an open window."
      actions={
        <Button variant="ghost" size="sm" disabled={loading || installing} onClick={checkAgain}>
          <RefreshCw size={14} aria-hidden="true" /> Check again
        </Button>
      }
    >
      {error ? (
        <p className="form-error" role="alert">
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
      {!info && !error ? <p className="quiet">Checking the background service…</p> : null}
    </SettingsSection>
  );
};
