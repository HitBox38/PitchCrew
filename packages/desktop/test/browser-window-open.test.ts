import { expect, it } from 'vitest';
import type { HandlerDetails } from 'electron';
import { browserWindowOpenAction } from '../src/browser/window-open.ts';

it.each(['foreground-tab', 'background-tab'])(
  'opens ordinary %s links as embedded tabs',
  (disposition) => {
    expect(
      browserWindowOpenAction({ url: 'https://example.com/job', disposition } as HandlerDetails),
    ).toBe('tab');
  },
);
it('preserves real opener windows, blank-write authentication and POST popup bodies', () => {
  expect(
    browserWindowOpenAction({
      url: 'https://example.com/signin',
      disposition: 'new-window',
    } as HandlerDetails),
  ).toBe('popup');
  expect(
    browserWindowOpenAction({
      url: 'about:blank',
      disposition: 'foreground-tab',
    } as HandlerDetails),
  ).toBe('popup');
  expect(
    browserWindowOpenAction({
      url: 'https://example.com/form',
      disposition: 'foreground-tab',
      postBody: { data: [], headers: '' },
    } as unknown as HandlerDetails),
  ).toBe('popup');
});
it.each(['javascript:alert(1)', 'file:///tmp/x', 'data:text/html,secret', 'app://settings'])(
  'blocks unowned popup scheme %s',
  (url) => {
    expect(browserWindowOpenAction({ url, disposition: 'new-window' } as HandlerDetails)).toBe(
      'deny',
    );
  },
);
