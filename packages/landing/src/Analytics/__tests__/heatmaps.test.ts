import { describe, expect, it, vi } from 'vitest';
import { createAnalytics, sdkConfig } from '../client';
import { sanitizeEvent } from '../helpers';
import { heatmapConfig, publicLandingUrl, sanitizeHeatmap } from '../heatmaps';

const point = { x: 100, y: 1200, target_fixed: false, type: 'click' };
const heatmap = (
  properties: Record<string, unknown> = {},
): {
  event: string;
  properties: Record<string, unknown>;
} => ({
  event: '$$heatmap',
  properties: {
    $heatmap_data: { 'https://private.invalid/?token=secret#name': [point] },
    $viewport_width: 1280,
    $viewport_height: 720,
    ...properties,
  },
});

describe('public landing heatmaps', () => {
  it('rebuilds native URL-keyed batches using fixed geometry and a fixed public homepage', () => {
    const source = heatmap({
      $current_url: 'private',
      $elements: [{ text: 'secret', href: 'private' }],
      $el_text: 'secret',
      release_sha: 'secret',
      $heatmap_data: {
        'https://private.invalid/?token=secret': [
          { ...point, text: 'secret', href: 'private', clipboard: 'secret' },
          { ...point, type: 'rageclick' },
          { ...point, type: 'deadclick' },
          { ...point, type: 'mousemove' },
        ],
      },
    });
    const clean = sanitizeEvent(source);
    expect(clean?.properties.$heatmap_data).toEqual({
      [publicLandingUrl]: ['click', 'rageclick', 'deadclick', 'mousemove'].map((type) => ({
        ...point,
        type,
      })),
    });
    expect(clean?.properties.$current_url).toBe(publicLandingUrl);
    expect(JSON.stringify(clean)).not.toMatch(/private|secret|clipboard|href|release_sha/);
    expect(source.properties.$current_url).toBe('private');
  });

  it('rejects malformed geometry and viewport values rather than inventing measurements', () => {
    for (const value of [null, [], 'secret', { url: [null, 1, {}, { ...point, x: -1 }] }])
      expect(sanitizeHeatmap(value)).toBeNull();
    for (const value of [NaN, Infinity, -1, '1280', 10001, 0])
      expect(sanitizeEvent(heatmap({ $viewport_width: value }))).toBeNull();
    for (const invalid of [
      { ...point, x: NaN },
      { ...point, y: 100001 },
      { ...point, target_fixed: 'false' },
      { ...point, type: 'secret' },
    ])
      expect(sanitizeHeatmap({ url: [invalid] })).toBeNull();
  });

  it('bounds work and event size across multiple raw URL keys', () => {
    const result = sanitizeHeatmap({ private: Array(2500).fill(point), other: [point] });
    expect(result?.[publicLandingUrl]).toHaveLength(2000);
    expect(sanitizeHeatmap({ bad: Array(2001).fill(null), other: [point] })).toBeNull();
  });

  it('preserves native scrollmap links and bounded scroll measurements without raw paths', () => {
    const id = '019a019a-019a-7000-8000-019a019a019a';
    const clean = sanitizeEvent({
      event: '$pageleave',
      properties: {
        $prev_pageview_id: id,
        $prev_pageview_pathname: '/secret',
        $prev_pageview_max_scroll: 2000,
        $prev_pageview_max_scroll_percentage: 0.75,
        $prev_pageview_max_content_percentage: 1,
        $prev_pageview_last_scroll_percentage: 1.1,
        $viewport_height: 720,
        $viewport_width: 1280,
        $referrer: 'secret',
      },
    });
    expect(clean?.properties).toMatchObject({
      $prev_pageview_id: id,
      $prev_pageview_pathname: '/',
      $prev_pageview_max_scroll: 2000,
      $prev_pageview_max_scroll_percentage: 0.75,
      $prev_pageview_max_content_percentage: 1,
      $current_url: publicLandingUrl,
    });
    expect(clean?.properties).not.toHaveProperty('$prev_pageview_last_scroll_percentage');
    expect(JSON.stringify(clean)).not.toContain('secret');
    expect(sanitizeEvent({ event: '$dead_click', properties: { $el_text: 'secret' } })).toBeNull();
  });

  it('turns listeners off and discards native buffers on opt-out before future opt-in', async () => {
    let allowed = true;
    let buffer = heatmap();
    let beforeSend!: (event: typeof buffer) => unknown;
    const sdk = {
      init: vi.fn(),
      capture: vi.fn(),
      set_config: vi.fn(),
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
      heatmaps: {
        getAndClearBuffer: vi.fn(() => {
          buffer = heatmap({ $heatmap_data: {} });
          return undefined;
        }),
      },
    };
    sdk.init.mockImplementation((_token, config) => {
      beforeSend = config.before_send;
    });
    const analytics = createAnalytics(
      async () => sdk,
      () => allowed,
    );
    await analytics.setEnabled(true);
    expect(sdkConfig.capture_heatmaps).toBe(false);
    expect(sdkConfig.autocapture).toBe(false);
    expect(heatmapConfig.mask_all_text).toBe(true);
    expect(sdk.set_config).toHaveBeenCalledWith(heatmapConfig);
    expect(beforeSend(buffer)).not.toBeNull();
    allowed = false;
    expect(beforeSend(buffer)).toBeNull();
    await analytics.setEnabled(false);
    expect(sdk.heatmaps.getAndClearBuffer).toHaveBeenCalledOnce();
    expect(sdk.set_config).toHaveBeenLastCalledWith({
      disable_persistence: true,
      capture_heatmaps: false,
      rageclick: false,
    });
    allowed = true;
    await analytics.setEnabled(true);
    expect(beforeSend(buffer)).toBeNull();
  });
});
