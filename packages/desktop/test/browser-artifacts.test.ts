import { beforeEach, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { NativeGroup } from '../src/browser/pages.ts';
import { installBrowserArtifactIpc } from '../src/browser/artifacts.ts';

const mock = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  save: vi.fn(),
  write: vi.fn(),
  reveal: vi.fn(),
  clipboard: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { getPath: () => '/downloads' },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
      mock.handlers.set(channel, handler),
  },
  dialog: { showSaveDialog: mock.save },
  shell: { showItemInFolder: mock.reveal },
  clipboard: { write: mock.clipboard },
  ClipboardItem: class {
    constructor(readonly data: Record<string, Blob>) {}
  },
  nativeImage: {
    createFromBuffer: (bytes: Buffer) => ({ isEmpty: () => false, toPNG: () => bytes }),
  },
}));
vi.mock('node:fs/promises', () => ({ writeFile: mock.write }));
beforeEach(() => {
  mock.handlers.clear();
  vi.clearAllMocks();
});

const fixture = () => {
  const bytes = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
  bytes.writeUInt32BE(390, 16);
  bytes.writeUInt32BE(844, 20);
  const page = {
    send: vi.fn(async () => ({ data: bytes.toString('base64') })),
    contents: {
      isDestroyed: () => false,
      getURL: () => 'https://example.com/apply',
      getTitle: () => 'Application',
    },
  };
  const group = {
    active: 'page',
    pages: new Map([['page', page]]),
    manualUntil: Date.now() + 45000,
    bounds: { width: 390, height: 844 },
  };
  const id = '2c43a8f3-ab30-416e-9474-ebedab5c08c4';
  const authorize = vi.fn();
  installBrowserArtifactIpc(
    new Map([[id, group as unknown as NativeGroup]]),
    authorize,
    () => ({ isDestroyed: () => false }) as BrowserWindow,
  );
  const call = (name: string, ...args: unknown[]) =>
    Promise.resolve().then(() => mock.handlers.get(`pitchcrew:browser:${name}`)!({}, ...args));
  return { id, bytes, page, group, authorize, call };
};

it('captures the owned live page with its actual dimensions only during private user control', async () => {
  const { id, call, group, page } = fixture();
  expect(await call('capture', id)).toMatchObject({
    width: 390,
    height: 844,
    title: 'Application',
  });
  expect(page.send).toHaveBeenCalledWith('Page.captureScreenshot', { format: 'png' });
  group.manualUntil = 0;
  await expect(call('capture', id)).rejects.toThrow('Take control');
});
it('rejects stale captures after page or controller changes', async () => {
  const { id, call, page, group } = fixture();
  page.send.mockImplementationOnce(async () => {
    group.active = 'another';
    return { data: Buffer.alloc(24).toString('base64') };
  });
  await expect(call('capture', id)).rejects.toThrow('page changed');
});
it('saves exact PNG bytes to a user-chosen file and reveals only artifacts saved in this session', async () => {
  const { call, bytes, authorize } = fixture();
  mock.save.mockResolvedValue({ canceled: false, filePath: '/chosen/screenshot.png' });
  expect(await call('save-artifact', 'png', bytes.toString('base64'))).toBe(
    '/chosen/screenshot.png',
  );
  expect(mock.write).toHaveBeenCalledWith('/chosen/screenshot.png', bytes);
  await call('reveal-artifact', '/chosen/screenshot.png');
  expect(mock.reveal).toHaveBeenCalledWith('/chosen/screenshot.png');
  await expect(call('reveal-artifact', '/private/unrelated.txt')).rejects.toThrow('unavailable');
  expect(authorize).toHaveBeenCalledTimes(3);
});
it('retains cancel without writing, and rejects malformed content or unauthorized IPC', async () => {
  const { call, bytes, authorize } = fixture();
  mock.save.mockResolvedValue({ canceled: true });
  expect(await call('save-artifact', 'png', bytes.toString('base64'))).toBeNull();
  expect(mock.write).not.toHaveBeenCalled();
  await expect(call('save-artifact', 'webm', bytes.toString('base64'))).rejects.toThrow('invalid');
  authorize.mockImplementation(() => {
    throw new Error('Unauthorized frame');
  });
  await expect(call('save-artifact', 'png', bytes.toString('base64'))).rejects.toThrow(
    'Unauthorized',
  );
  expect(mock.save).toHaveBeenCalledTimes(1);
});

it('copies only a validated PNG representation to the system clipboard', async () => {
  const { call, bytes } = fixture();
  await call('copy-capture', bytes.toString('base64'));
  const items = mock.clipboard.mock.calls[0][0] as { data: Record<string, Blob> }[];
  expect(Object.keys(items[0].data)).toEqual(['image/png']);
  expect(Buffer.from(await items[0].data['image/png'].arrayBuffer())).toEqual(bytes);
  await expect(
    call('copy-capture', Buffer.from('not an image').toString('base64')),
  ).rejects.toThrow('invalid');
  expect(mock.clipboard).toHaveBeenCalledTimes(1);
});
