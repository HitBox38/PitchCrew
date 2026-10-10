'use client';

import { Button } from '../components/ui/button';
import { useAnalytics } from './hooks/useAnalytics';

export function Analytics() {
  const { enabled, available, toggle } = useAnalytics();
  return (
    <Button
      variant="ghost"
      className="analytics-preference"
      onClick={toggle}
      disabled={!available}
      aria-pressed={enabled}
      title={
        available
          ? 'Toggle anonymous website visits and download-click analytics'
          : 'Website analytics is disabled by configuration, development mode, or Do Not Track'
      }
    >
      Website analytics: {enabled ? 'on' : 'off'}
    </Button>
  );
}
