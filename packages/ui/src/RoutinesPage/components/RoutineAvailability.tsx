import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { loadBackgroundService } from '@/BackgroundServiceSettings/api.ts';

/** States the real execution condition: the installed background service, or this open app. */
export const RoutineAvailability = () => {
  const [service, setService] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void loadBackgroundService(controller.signal)
      .then(({ status, matches }) => {
        if (!controller.signal.aborted)
          setService(Boolean(status.installed && matches && status.running && status.enabled));
      })
      .catch(() => {
        if (!controller.signal.aborted) setService(false);
      });
    return () => controller.abort();
  }, []);
  return (
    <span className="routines-availability">
      {service
        ? 'Runs from the background service, even with Pitchcrew closed.'
        : 'Runs while Pitchcrew is open.'}{' '}
      One overdue run is picked up after downtime.
      {service === false ? (
        <>
          {' '}
          <Link to="/settings" search={{ section: 'data' }}>
            Background service
          </Link>
        </>
      ) : null}
    </span>
  );
};
