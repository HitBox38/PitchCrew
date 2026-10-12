'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { analytics } from './client';
import { Button } from '../components/ui/button';
import { useAnalytics } from './hooks/useAnalytics';

const reportVital: Parameters<typeof useReportWebVitals>[0] = (metric) => {
  analytics.captureWebVital({ name: metric.name, value: metric.value });
};

export function Analytics() {
  useReportWebVitals(reportVital);
  const { enabled, available, toggle, replay, toggleReplay } = useAnalytics();
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
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
      <Button
        variant="ghost"
        className="analytics-preference"
        onClick={toggleReplay}
        disabled={!available || !enabled}
        aria-pressed={replay}
        title="Optional masked recordings of website layout, clicks and scrolling. All text and inputs hidden. Off by default."
      >
        Website session replay: {replay ? 'on' : 'off'} (optional)
      </Button>
    </div>
  );
}
