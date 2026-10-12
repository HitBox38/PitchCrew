import { installerDefinitions } from '../Downloads/constants';
import { analyticsContext } from './context';
import { heatmapMeasurements, publicLandingUrl, sanitizeHeatmap } from './heatmaps';

export const replayPreferenceKey = 'pitchcrew-landing-replay-v1';
export function replayAllowed(
  storage: Pick<Storage, 'getItem'>,
  doNotTrack: string | null,
): boolean {
  try {
    return analyticsAllowed(storage, doNotTrack) && storage.getItem(replayPreferenceKey) === 'on';
  } catch {
    return false;
  }
}

export const preferenceKey = 'pitchcrew-landing-analytics-v1';

export function sanitizeEvent<T extends { event: string; properties: Record<string, unknown> }>(
  event: T | null,
): T | null {
  if (
    !event ||
    ![
      'landing_page_viewed',
      'landing_download_clicked',
      '$pageview',
      '$pageleave',
      '$web_vitals',
      '$$heatmap',
    ].includes(event.event)
  )
    return null;
  const input = event.properties;
  const properties: Record<string, unknown> = {
    $process_person_profile: false,
    $geoip_disable: true,
    ...analyticsContext,
  };
  for (const key of ['token', 'distinct_id', '$lib', '$lib_version'])
    if (typeof input[key] === 'string') properties[key] = input[key];
  // PostHog-generated anonymous IDs connect visits, durations and vital measurements.
  for (const key of ['$session_id', '$window_id', '$pageview_id', '$prev_pageview_id']) {
    if (typeof input[key] === 'string' && /^[a-f0-9-]{36}$/i.test(input[key]))
      properties[key] = input[key];
  }
  properties.$host = 'pitch-crew.tomer-norman.dev';
  properties.$pathname = '/';
  if (['$$heatmap', '$pageview', '$pageleave'].includes(event.event)) {
    // Ingestion needs the page URL for native heatmap and scrollmap rows.
    // This is a constant public page, never window.location or a link href.
    properties.$current_url = publicLandingUrl;
    Object.assign(properties, heatmapMeasurements(input, event.event === '$pageleave'));
  }
  if (event.event === '$$heatmap') {
    const points = sanitizeHeatmap(input.$heatmap_data);
    if (!points || !properties.$viewport_width || !properties.$viewport_height) return null;
    properties.$heatmap_data = points;
  }
  if (event.event === '$pageleave') {
    const duration = input.$prev_pageview_duration;
    if (
      typeof duration === 'number' &&
      Number.isFinite(duration) &&
      duration >= 0 &&
      duration <= 86400
    )
      properties.$prev_pageview_duration = duration;
  }
  if (event.event === '$web_vitals') {
    let measurements = 0;
    for (const name of ['LCP', 'CLS', 'INP', 'FCP']) {
      const key = `$web_vitals_${name}_value`;
      const value = input[key];
      if (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= (name === 'CLS' ? 100 : 900000)
      ) {
        properties[key] = value;
        measurements++;
      }
    }
    if (!measurements) return null;
  }
  if (event.event === 'landing_download_clicked') {
    const installer = installerDefinitions.find((definition) => definition.id === input.installer);
    if (!installer || !['installer', 'releases'].includes(input.destination as string)) return null;
    properties.installer = installer.id;
    properties.platform = installer.platform;
    properties.destination = input.destination;
  }
  return { ...event, properties };
}

export function analyticsAllowed(
  storage: Pick<Storage, 'getItem'>,
  doNotTrack: string | null,
): boolean {
  if (doNotTrack === '1' || doNotTrack === 'yes') return false;
  try {
    return storage.getItem(preferenceKey) !== 'off';
  } catch {
    return false;
  }
}
