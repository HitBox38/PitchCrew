import { EventEmitter } from 'node:events';
import { beforeEach, expect, it, vi } from 'vitest';
import type { NativeGroup } from '../src/browser/pages.ts';
import {
  cancelPick,
  installBrowserPickIpc,
  pickedBox,
  pickedClip,
  pickedName,
  pickedText,
} from '../src/browser/pick.ts';

const mock = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
      mock.handlers.set(channel, handler),
  },
}));
beforeEach(() => mock.handlers.clear());

const png = () => {
  const bytes = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
  bytes.writeUInt32BE(136, 16);
  bytes.writeUInt32BE(56, 20);
  return bytes.toString('base64');
};

const fixture = () => {
  const debug = new EventEmitter();
  const contents = Object.assign(new EventEmitter(), {
    id: 7,
    debugger: debug,
    isDestroyed: () => false,
    getZoomFactor: () => 1,
    getURL: () => 'https://jobs.example/apply',
    getTitle: () => 'Apply',
  });
  const send = vi.fn(async (method: string) => {
    if (method === 'Overlay.setInspectMode') return {};
    if (method === 'DOM.getBoxModel')
      return { model: { border: [20, 30, 140, 30, 140, 70, 20, 70] } };
    if (method === 'DOM.describeNode')
      return {
        node: {
          nodeType: 1,
          localName: 'button',
          attributes: ['class', 'cta', 'value', 'hidden-default'],
          children: [{ nodeType: 3, localName: '', nodeValue: ' Apply   now ' }],
        },
      };
    if (method === 'Page.getLayoutMetrics')
      return { cssLayoutViewport: { clientWidth: 1280, clientHeight: 800 } };
    if (method === 'Page.captureScreenshot') return { data: png() };
    return {};
  });
  const page = { contents, send, releaseAutomation: vi.fn() };
  const group = {
    active: 'page',
    pages: new Map([['page', page]]),
    manualUntil: Date.now() + 45000,
    bounds: { x: 0, y: 0, width: 1280, height: 800 },
  };
  const id = '2c43a8f3-ab30-416e-9474-ebedab5c08c4';
  installBrowserPickIpc(new Map([[id, group as unknown as NativeGroup]]), vi.fn());
  const call = (name: string, ...args: unknown[]) =>
    Promise.resolve().then(() => mock.handlers.get(`pitchcrew:browser:${name}`)!({}, ...args));
  const inspecting = () =>
    vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        'Overlay.setInspectMode',
        expect.objectContaining({ mode: 'searchForNode' }),
        undefined,
        expect.stringMatching(/^pick:7:/),
      ),
    );
  return { id, call, send, page, group, debug, inspecting };
};

it('returns the clicked element cropped, labelled from its own text and never a field value', async () => {
  const { id, call, send, page, debug, inspecting } = fixture();
  const picked = call('pick', id);
  await inspecting();
  debug.emit('message', {}, 'Overlay.inspectNodeRequested', { backendNodeId: 42 }, '');
  expect(await picked).toMatchObject({
    width: 136,
    height: 56,
    url: 'https://jobs.example/apply',
    label: 'Button “Apply now”',
  });
  // The element's box, padded by 8px, is what the screenshot clips to.
  expect(send).toHaveBeenCalledWith(
    'Page.captureScreenshot',
    { format: 'png', clip: { x: 12, y: 22, width: 136, height: 56, scale: 1 } },
    undefined,
    expect.stringMatching(/^pick:7:/),
  );
  expect(send).toHaveBeenCalledWith(
    'Overlay.setInspectMode',
    { mode: 'none', highlightConfig: {} },
    undefined,
    expect.stringMatching(/^pick:7:/),
  );
  expect(page.releaseAutomation).toHaveBeenCalledWith(expect.stringMatching(/^pick:7:/));
  expect(debug.listenerCount('message')).toBe(0);
});

it('ends with nothing on Escape or a renderer cancel, and needs held control', async () => {
  const { id, call, group, inspecting } = fixture();
  const escaped = call('pick', id);
  await inspecting();
  cancelPick(7);
  expect(await escaped).toBeNull();
  const cancelled = call('pick', id);
  await inspecting();
  await call('pick-cancel', id);
  expect(await cancelled).toBeNull();
  group.manualUntil = 0;
  await expect(call('pick', id)).rejects.toThrow('Take control');
});

it('names, measures and reads picked elements conservatively', () => {
  expect(pickedName(['aria-label', 'Close dialog', 'title', 'x'], 'X')).toBe('Close dialog');
  expect(pickedName(['alt', 'Company logo'], '  ')).toBe('Company logo');
  expect(pickedName(['value', 'secret', 'name', 'email'], '')).toBe('email');
  expect(pickedBox([0, 0, 2, 0, 2, 2, 0, 2], { width: 100, height: 100 })).toEqual({
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
  expect(
    pickedBox([500, 500, 600, 500, 600, 600, 500, 600], { width: 100, height: 100 }),
  ).toBeNull();
  // A screenshot clip is in DIPs: page zoom scales the CSS-pixel box, or the crop shows
  // whatever sits above and left of the element.
  expect(pickedClip({ x: 12, y: 22, width: 136, height: 56 }, 1.25)).toEqual({
    x: 15,
    y: 27.5,
    width: 170,
    height: 70,
    scale: 1,
  });
  expect(
    pickedText({
      nodeType: 1,
      localName: 'a',
      children: [
        {
          nodeType: 1,
          localName: 'span',
          children: [{ nodeType: 3, localName: '', nodeValue: 'Learn' }],
        },
        {
          nodeType: 1,
          localName: 'script',
          children: [{ nodeType: 3, localName: '', nodeValue: 'x()' }],
        },
        { nodeType: 3, localName: '', nodeValue: 'more' },
      ],
    }).replace(/\s+/g, ' '),
  ).toBe('Learn more');
});

it('replaces a pick only after its cleanup, keeps Escape working and ends when the page is unpresented', async () => {
  const { id, call, group, debug, inspecting, send } = fixture();
  const first = call('pick', id);
  await inspecting();
  const second = call('pick', id);
  expect(await first).toBeNull();
  await vi.waitFor(() =>
    expect(
      send.mock.calls.filter(([method]) => method === 'Overlay.setInspectMode').length,
    ).toBeGreaterThanOrEqual(3),
  );
  // Escape still reaches the replacement, whose cleanup the first pick did not remove.
  cancelPick(7);
  expect(await second).toBeNull();
  expect(debug.listenerCount('message')).toBe(0);
  const third = call('pick', id);
  await vi.waitFor(() => expect(debug.listenerCount('message')).toBe(1));
  group.bounds = null as never;
  expect(await third).toBeNull();
});
