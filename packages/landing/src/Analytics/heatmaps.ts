import type { PostHogConfig } from 'posthog-js';

export const publicLandingUrl = 'https://pitch-crew.tomer-norman.dev/';
export const heatmapConfig: Partial<PostHogConfig> = {
  capture_heatmaps: { flush_interval_milliseconds: 1000 },
  rageclick: {
    threshold_px: 30,
    timeout_ms: 1000,
    click_count: 3,
    content_ignorelist: false,
    css_selector_ignorelist: ['input', 'textarea', '[contenteditable]', '.ph-no-rageclick'],
  },
  mask_all_text: true,
  mask_all_element_attributes: true,
};

function boundedNumber(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
}

// SDK 1.435.8 emits URL-keyed $$heatmap batches through capture/before_send.
// Rebuild every point and key: neither an actual URL nor any DOM metadata survives.
export function sanitizeHeatmap(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const points: { x: number; y: number; type: string; target_fixed: boolean }[] = [];
  let examined = 0;
  for (const value of Object.values(input)) {
    if (!Array.isArray(value)) continue;
    for (const point of value) {
      if (++examined > 2000) break;
      if (!point || typeof point !== 'object' || Array.isArray(point)) continue;
      if (
        !['click', 'rageclick', 'deadclick', 'mousemove'].includes(point.type) ||
        !boundedNumber(point.x, 100000) ||
        !boundedNumber(point.y, 100000) ||
        typeof point.target_fixed !== 'boolean'
      )
        continue;
      points.push({ x: point.x, y: point.y, type: point.type, target_fixed: point.target_fixed });
    }
    if (examined >= 2000) break;
  }
  return points.length ? { [publicLandingUrl]: points } : null;
}

export function heatmapMeasurements(input: Record<string, unknown>, scroll: boolean) {
  const properties: Record<string, unknown> = {};
  for (const key of ['$viewport_width', '$viewport_height']) {
    if (boundedNumber(input[key], 10000) && input[key] > 0) properties[key] = input[key];
  }
  if (scroll) {
    for (const key of [
      '$prev_pageview_last_scroll',
      '$prev_pageview_max_scroll',
      '$prev_pageview_last_content',
      '$prev_pageview_max_content',
    ])
      if (boundedNumber(input[key], 100000)) properties[key] = input[key];
    for (const key of [
      '$prev_pageview_last_scroll_percentage',
      '$prev_pageview_max_scroll_percentage',
      '$prev_pageview_last_content_percentage',
      '$prev_pageview_max_content_percentage',
    ])
      if (boundedNumber(input[key], 1)) properties[key] = input[key];
    properties.$prev_pageview_pathname = '/';
  }
  return properties;
}
