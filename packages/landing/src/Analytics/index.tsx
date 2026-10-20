'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { analytics } from './client';
import { useAnalytics } from './hooks/useAnalytics';

/** Starts website analytics and offers a quiet opt-out (or opt back in) for this device. */
export const Analytics = () => {
  useReportWebVitals(reportVital);
  const { enabled, available, toggle } = useAnalytics();
  if (!available) return null;
  return (
    <button
      type="button"
      className="text-link cursor-pointer"
      onClick={toggle}
      title="Anonymous visit and download-click counts. The choice is saved on this device."
    >
      {enabled ? 'Opt out of analytics' : 'Analytics off · Turn back on'}
    </button>
  );
};

const reportVital: Parameters<typeof useReportWebVitals>[0] = (metric) => {
  analytics.captureWebVital({ name: metric.name, value: metric.value });
};
