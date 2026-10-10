import { installerDefinitions } from '../Downloads/constants';

export const preferenceKey = 'pitchcrew-landing-analytics-v1';

export function sanitizeEvent<T extends { event: string; properties: Record<string, unknown> }>(
  event: T | null,
): T | null {
  if (!event || !['landing_page_viewed', 'landing_download_clicked'].includes(event.event))
    return null;
  const input = event.properties;
  const properties: Record<string, unknown> = {
    $process_person_profile: false,
    $geoip_disable: true,
  };
  for (const key of ['token', 'distinct_id', '$lib', '$lib_version'])
    if (typeof input[key] === 'string') properties[key] = input[key];
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
