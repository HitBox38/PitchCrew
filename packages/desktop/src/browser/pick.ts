import { ipcMain, type BrowserWindow } from 'electron';
import { z } from 'zod';
import type { DesktopBrowserCapture } from '../../../core/src/native-browser.ts';
import type { NativeGroup } from './pages.ts';

type Box = { x: number; y: number; width: number; height: number };
type PickedNode = {
  nodeType: number;
  localName: string;
  nodeValue?: string;
  attributes?: string[];
  children?: PickedNode[];
};

/** Visible text from the element's own text nodes, a few levels deep, bounded. */
export const pickedText = (node: PickedNode): string =>
  (node.children ?? [])
    .map((child) =>
      child.nodeType === 3
        ? (child.nodeValue ?? '')
        : ['script', 'style', 'template'].includes(child.localName)
          ? ''
          : pickedText(child),
    )
    .join(' ')
    .slice(0, 400);

/**
 * The pending pick per guest contents id, so Escape on the page or a renderer cancel can end it.
 * `done` settles once its cleanup (inspect mode off, listener removed) has finished.
 */
const picks = new Map<number, { serial: number; cancel: () => void; done: Promise<void> }>();
let serials = 0;

/** Ends a pick on this guest, e.g. on Escape; resolves the pick with null. */
export const cancelPick = (contentsId: number) => picks.get(contentsId)?.cancel();

/** The element's own visible label from its attributes and direct text, never a field value. */
export const pickedName = (attributes: string[], text: string) => {
  const attribute = (name: string) => {
    const index = attributes.findIndex((value, position) => position % 2 === 0 && value === name);
    return index >= 0 ? (attributes[index + 1] ?? '').trim() : '';
  };
  return (
    attribute('aria-label') ||
    text.replace(/\s+/g, ' ').trim() ||
    attribute('alt') ||
    attribute('title') ||
    attribute('placeholder') ||
    attribute('name')
  ).slice(0, 120);
};

const roles: Record<string, string> = {
  a: 'Link',
  button: 'Button',
  h1: 'Heading',
  h2: 'Heading',
  h3: 'Heading',
  h4: 'Heading',
  h5: 'Heading',
  h6: 'Heading',
  input: 'Field',
  textarea: 'Field',
  select: 'List box',
  img: 'Image',
  svg: 'Image',
  picture: 'Image',
  ul: 'List',
  ol: 'List',
  li: 'List item',
  p: 'Paragraph',
  table: 'Table',
  nav: 'Navigation',
  form: 'Form',
  label: 'Label',
  section: 'Section',
  article: 'Article',
};

/** "Heading “Open Roles”": what a picked element is, in words rather than its tag. */
export const pickedLabel = (node: Pick<PickedNode, 'localName' | 'attributes'>, name: string) => {
  const attributes = node.attributes ?? [];
  const index = attributes.findIndex((value, position) => position % 2 === 0 && value === 'role');
  const role = index >= 0 ? (attributes[index + 1] ?? '').trim() : '';
  const kind = role
    ? `${role.charAt(0).toUpperCase()}${role.slice(1)}`
    : (roles[node.localName] ?? 'Element');
  return name ? `${kind} “${name}”` : kind;
};

/** The border quad's bounding box, padded and clipped to the viewport, in CSS pixels. */
export const pickedBox = (quad: number[], viewport: { width: number; height: number }) => {
  const xs = [quad[0], quad[2], quad[4], quad[6]];
  const ys = [quad[1], quad[3], quad[5], quad[7]];
  const pad = 8;
  const x = Math.max(0, Math.floor(Math.min(...xs) - pad));
  const y = Math.max(0, Math.floor(Math.min(...ys) - pad));
  const right = Math.min(viewport.width, Math.ceil(Math.max(...xs) + pad));
  const bottom = Math.min(viewport.height, Math.ceil(Math.max(...ys) + pad));
  return right - x >= 4 && bottom - y >= 4 ? { x, y, width: right - x, height: bottom - y } : null;
};

/**
 * User-only element picking on the selected page, like DevTools' inspect: Chromium highlights
 * what the pointer is over, a click picks it, and the element comes back as a cropped PNG with
 * its tag and visible name for the user to review before attaching. It needs held control,
 * ends on Escape, a renderer cancel, a minute without a pick, or the page, its presentation or
 * control changing. A new pick waits for the previous one's cleanup. Reads go through CDP's DOM
 * domain only; no page script runs.
 */
export const installBrowserPickIpc = (
  groups: Map<string, NativeGroup>,
  authorize: (event: Electron.IpcMainInvokeEvent) => void,
  getWindow: () => BrowserWindow | null = () => null,
) => {
  ipcMain.handle('pitchcrew:browser:pick-cancel', (event, rawId: unknown) => {
    authorize(event);
    const group = groups.get(z.uuid().parse(rawId));
    const page = group?.pages.get(group.active);
    if (page) cancelPick(page.contents.id);
  });
  ipcMain.handle(
    'pitchcrew:browser:pick',
    async (event, rawId: unknown): Promise<(DesktopBrowserCapture & { label: string }) | null> => {
      authorize(event);
      const group = groups.get(z.uuid().parse(rawId));
      const page = group?.pages.get(group.active);
      if (!group || !page || !group.bounds || group.manualUntil <= Date.now())
        throw new Error('Take control to pick an element on this page.');
      const contents = page.contents;
      const previous = picks.get(contents.id);
      if (previous) {
        previous.cancel();
        await previous.done;
      }
      const serial = ++serials;
      const owner = `pick:${contents.id}:${serial}`;
      const send = <T>(method: string, params: Record<string, unknown> = {}) =>
        page.send(method, params, undefined, owner) as Promise<T>;
      let cleaned: () => void = () => {};
      const done = new Promise<void>((resolve) => {
        cleaned = resolve;
      });
      let finish: (node: number | null) => void = () => {};
      const picked = new Promise<number | null>((resolve) => {
        finish = resolve;
      });
      const message = (_event: unknown, method: string, params: unknown, sessionId?: string) => {
        if (method === 'Overlay.inspectNodeRequested' && !sessionId)
          finish((params as { backendNodeId: number }).backendNodeId);
      };
      const watch = setInterval(() => {
        if (
          group.manualUntil <= Date.now() ||
          group.pages.get(group.active) !== page ||
          !group.bounds ||
          contents.isDestroyed()
        )
          finish(null);
      }, 300);
      let expired = false;
      const timeout = setTimeout(() => {
        expired = true;
        finish(null);
      }, 60_000);
      picks.set(contents.id, { serial, cancel: () => finish(null), done });
      contents.debugger.on('message', message);
      try {
        await send('DOM.enable');
        await send('Overlay.enable');
        // The app's own highlight (primary: the user holds the page), without DevTools' box of
        // class names and sizes.
        await send('Overlay.setInspectMode', {
          mode: 'searchForNode',
          highlightConfig: {
            showInfo: false,
            showAccessibilityInfo: false,
            contentColor: { r: 87, g: 106, b: 139, a: 0.3 },
            paddingColor: { r: 87, g: 106, b: 139, a: 0.18 },
            borderColor: { r: 87, g: 106, b: 139, a: 0.95 },
          },
        });
        const backendNodeId = await picked;
        if (expired) throw new Error('Picking ended after a minute without a click.');
        if (!backendNodeId || contents.isDestroyed()) return null;
        const { model } = await send<{ model: { border: number[] } }>('DOM.getBoxModel', {
          backendNodeId,
        });
        const { node } = await send<{ node: PickedNode }>('DOM.describeNode', {
          backendNodeId,
          depth: 3,
        });
        const metrics = await send<{
          cssLayoutViewport: { clientWidth: number; clientHeight: number };
        }>('Page.getLayoutMetrics');
        const viewport = {
          width: metrics.cssLayoutViewport.clientWidth,
          height: metrics.cssLayoutViewport.clientHeight,
        };
        const box: Box | null = pickedBox(model.border, viewport);
        if (!box) throw new Error('That element isn’t visible on the page.');
        const shot = await send<{ data: string }>('Page.captureScreenshot', {
          format: 'png',
          clip: { ...box, scale: 1 },
        });
        if (group.manualUntil <= Date.now() || group.pages.get(group.active) !== page)
          throw new Error('The browser page changed while picking.');
        const bytes = Buffer.from(shot.data, 'base64');
        if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
          throw new Error('The browser returned an invalid element image.');
        const text = pickedText(node);
        const name = pickedName(node.attributes ?? [], text);
        return {
          data: shot.data,
          width: bytes.readUInt32BE(16),
          height: bytes.readUInt32BE(20),
          url: contents.getURL(),
          title: contents.getTitle(),
          label: pickedLabel(node, name),
        };
      } finally {
        clearInterval(watch);
        clearTimeout(timeout);
        contents.debugger.removeListener('message', message);
        if (!contents.isDestroyed()) {
          await send('Overlay.setInspectMode', { mode: 'none', highlightConfig: {} }).catch(
            () => {},
          );
          await send('Overlay.hideHighlight').catch(() => {});
        }
        page.releaseAutomation?.(owner);
        // Only this pick's own entry: a newer pick may already be waiting on `done`.
        if (picks.get(contents.id)?.serial === serial) picks.delete(contents.id);
        cleaned();
        // The click landed in the page; give the keyboard back to the app for the review dialog.
        const window = getWindow();
        if (window && !window.isDestroyed() && window.isFocused()) window.webContents.focus();
      }
    },
  );
};
