import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { retryFailedLoads, retryableLazy, type RetryableLazy } from '@/lib/retryable-lazy.ts';
import { LoadFailure } from '../components/LoadFailure.tsx';
import { PanelLoadBoundary } from '../components/PanelLoadBoundary.tsx';
import { isModuleLoadError, loadFailureCopy } from '../helpers.ts';
import { createAppRouter } from '@/router.ts';
import { RouteLoadError } from '../components/RouteLoadError.tsx';

const moduleError = () =>
  new TypeError(
    'Failed to fetch dynamically imported module: http://127.0.0.1:4418/src/components/CardDetails/index.tsx',
  );
const Panel = ({ label }: { label: string }) => createElement('p', null, `Loaded ${label}`);

/** Renders like React would: suspend on the pending import, then render or throw. */
const render = async (Lazy: RetryableLazy<typeof Panel>) => {
  await Lazy.preload();
  return renderToStaticMarkup(createElement(Lazy, { label: 'job' }));
};
const failure = (error: unknown, onClose?: () => void) =>
  renderToStaticMarkup(
    createElement(LoadFailure, {
      error,
      subject: 'Job details',
      onRetry: () => undefined,
      onClose,
    }),
  );

afterEach(() => {
  retryFailedLoads();
  vi.unstubAllGlobals();
});

describe('lazy pages and panels', () => {
  it('hand a failed import to the boundary and never reload the window by themselves', async () => {
    const reload = vi.fn();
    // TanStack's loader reloads once when sessionStorage has no marker; ours must not.
    vi.stubGlobal('window', { location: { reload } });
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: vi.fn() });
    const importer = vi
      .fn<() => Promise<{ Panel: typeof Panel }>>()
      .mockRejectedValueOnce(moduleError())
      .mockResolvedValue({ Panel });
    const Lazy = retryableLazy(importer, 'Panel');

    const first = await render(Lazy).catch((error: unknown) => error);
    expect(isModuleLoadError(first)).toBe(true);
    // Rendering again without an explicit request neither re-imports nor reloads.
    await expect(render(Lazy)).rejects.toBe(first);
    expect(importer).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();

    // An explicit request asks for the module again (React.lazy would keep the rejection).
    expect(retryFailedLoads()).toBe(1);
    expect(await render(Lazy)).toBe('<p>Loaded job</p>');
    expect(importer).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
  });

  it('share one in-flight import between preload and render', async () => {
    let resolve!: (module: { Panel: typeof Panel }) => void;
    const importer = vi.fn(() => new Promise<{ Panel: typeof Panel }>((done) => (resolve = done)));
    const Lazy = retryableLazy(importer, 'Panel');
    const preload = [Lazy.preload(), Lazy.preload()];
    resolve({ Panel });
    await Promise.all(preload);
    expect(importer).toHaveBeenCalledTimes(1);
    expect(renderToStaticMarkup(createElement(Lazy, { label: 'once' }))).toBe('<p>Loaded once</p>');
  });
});

describe('load failure recovery', () => {
  it('offers a confirmed reload, not a futile Try again, when a file failed to download', () => {
    const markup = failure(moduleError(), () => undefined);
    expect(markup).toContain('Job details didn’t load');
    expect(markup).toContain('Reloading Pitchcrew fetches it again');
    for (const action of ['Reload Pitchcrew…', 'Close', 'Technical details'])
      expect(markup).toContain(action);
    expect(markup).not.toContain('Try again');
    // The module address and browser wording stay behind the closed disclosure.
    expect(markup).not.toContain('127.0.0.1');
    expect(markup).not.toContain('dynamically imported module');
  });

  it('offers Try again for a render crash and says drafts stay while the window is open', () => {
    const markup = failure(new Error('Cannot read properties of undefined'));
    expect(markup).toContain('Job details stopped working');
    expect(markup).toContain('unsent drafts stay while this window is open');
    expect(markup).toContain('Try again');
    expect(markup).toContain('Reload Pitchcrew…');
    expect(markup).not.toContain('>Close<');
    expect(loadFailureCopy(new Error('x'), 'This page').body).not.toMatch(/download/);
  });

  it('turns a panel crash into a closable failure while the workspace keeps rendering', () => {
    const onClose = vi.fn();
    const boundary = new PanelLoadBoundary({ subject: 'Job details', onClose, children: null });
    boundary.state = PanelLoadBoundary.getDerivedStateFromError(moduleError());
    const panel = boundary.render() as { props: { onClose: () => void; onRetry: () => void } };
    panel.props.onClose();
    expect(onClose).toHaveBeenCalledOnce();
    const setState = vi.spyOn(boundary, 'setState').mockImplementation(() => undefined);
    panel.props.onRetry();
    expect(setState).toHaveBeenCalledWith({ error: undefined });
  });

  it('gives every route the clay recovery page instead of the raw default', () => {
    expect(createAppRouter().options.defaultErrorComponent).toBe(RouteLoadError);
  });
});
